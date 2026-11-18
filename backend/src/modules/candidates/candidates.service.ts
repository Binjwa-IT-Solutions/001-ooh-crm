import mongoose from 'mongoose';
import type { RequestContext } from '../../core/context.js';
import { toObjectId } from '../../core/db/basePlugin.js';
import { NotFoundError } from '../../core/errors/index.js';
import { fileService } from '../../core/files/index.js';
import { CandidateModel, type Candidate, type InterviewRound } from './candidates.model.js';
import type { CreateCandidateInput, ListCandidatesQuery, UpdateCandidateInput, InterviewRoundInput } from './candidates.validator.js';

export const candidateService = {
  async create(
    input: CreateCandidateInput,
    resumeFile: Express.Multer.File | undefined,
    ctx: RequestContext
  ) {
    let resumeFileKey: string | null = null;

    if (resumeFile) {
      const stored = await fileService.save(resumeFile, { folder: 'resumes', ctx });
      resumeFileKey = stored.key;
    }

    const initialRounds: any[] =
      input.interviewRounds && input.interviewRounds.length > 0
        ? input.interviewRounds.map((r, i) => ({
            ...r,
            roundNumber: r.roundNumber || i + 1,
            roundName: r.roundName || `Round ${i + 1}`,
            interviewedBy: toObjectId(r.interviewedBy),
          }))
        : [
            {
              roundNumber: 1,
              roundName: 'Round 1 - Initial Interview',
              interviewDate: input.interviewDate,
              interviewedBy: toObjectId(ctx.user.id),
              notes: input.notes || null,
              status: input.status || 'Scheduled',
            },
          ];

    const candidate = await CandidateModel.create({
      ...input,
      interviewedBy: toObjectId(ctx.user.id),
      resumeFileKey,
      createdBy: toObjectId(ctx.user.id),
      interviewRounds: initialRounds,
    });

    return candidate;
  },

  async list(query: ListCandidatesQuery, ctx: RequestContext) {
    const filter: Record<string, any> = { deletedAt: null };

    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { email: { $regex: query.search, $options: 'i' } },
        { mobile: { $regex: query.search, $options: 'i' } },
      ];
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.position) {
      filter.position = { $regex: query.position, $options: 'i' };
    }

    if (query.resume === 'available') {
      filter.resumeFileKey = { $ne: null };
    } else if (query.resume === 'none') {
      filter.resumeFileKey = null;
    }

    if (query.startDate || query.endDate) {
      filter.interviewDate = {};
      if (query.startDate) filter.interviewDate.$gte = query.startDate;
      if (query.endDate) filter.interviewDate.$lte = query.endDate;
    }

    const total = await CandidateModel.countDocuments(filter);
    const data = await CandidateModel.find(filter)
      .populate('interviewedBy', 'name email role')
      .populate('interviewRounds.interviewedBy', 'name email role')
      .sort({ [query.sortBy]: query.sortDir === 'desc' ? -1 : 1 })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .lean();

    const populated = await Promise.all(
      data.map(async (c: any) => ({
        ...c,
        resumeUrl: c.resumeFileKey ? await fileService.url(c.resumeFileKey) : null,
      }))
    );

    return { data: populated, total, page: query.page, pageSize: query.pageSize };
  },

  async getById(id: string, ctx: RequestContext) {
    const filter: Record<string, any> = { _id: id, deletedAt: null };
    const candidate = await CandidateModel.findOne(filter)
      .populate('interviewedBy', 'name email role')
      .populate('interviewRounds.interviewedBy', 'name email role')
      .lean();

    if (!candidate) throw new NotFoundError('Candidate not found');

    let resumeUrl: string | null = null;
    if (candidate.resumeFileKey) {
      resumeUrl = await fileService.url(candidate.resumeFileKey);
    }

    // Ensure interviewRounds has at least the initial round if legacy candidate
    let rounds = candidate.interviewRounds || [];
    if (rounds.length === 0 && candidate.interviewDate) {
      rounds = [
        {
          _id: candidate._id,
          roundNumber: 1,
          roundName: 'Round 1 - Initial Interview',
          interviewDate: candidate.interviewDate,
          interviewedBy: candidate.interviewedBy as any,
          notes: candidate.notes || null,
          status: candidate.status || 'Scheduled',
        },
      ];
    }

    return { ...candidate, interviewRounds: rounds, resumeUrl };
  },

  async update(
    id: string,
    input: UpdateCandidateInput,
    resumeFile: Express.Multer.File | undefined,
    ctx: RequestContext
  ) {
    const filter: Record<string, any> = { _id: id, deletedAt: null };

    const updateData: Record<string, any> = {
      ...input,
      updatedBy: toObjectId(ctx.user.id),
    };

    if (input.interviewedBy) {
      updateData.interviewedBy = toObjectId(input.interviewedBy);
    }

    if (input.interviewRounds) {
      updateData.interviewRounds = input.interviewRounds.map((r, i) => ({
        ...r,
        roundNumber: r.roundNumber || i + 1,
        roundName: r.roundName || `Round ${i + 1}`,
        interviewedBy: toObjectId(r.interviewedBy),
      }));
    }

    if (resumeFile) {
      const stored = await fileService.save(resumeFile, { folder: 'resumes', ctx });
      updateData.resumeFileKey = stored.key;
    }

    const candidate = await CandidateModel.findOneAndUpdate(
      filter,
      { $set: updateData },
      { new: true }
    )
      .populate('interviewedBy', 'name email role')
      .populate('interviewRounds.interviewedBy', 'name email role')
      .lean();

    if (!candidate) throw new NotFoundError('Candidate not found');

    let resumeUrl: string | null = null;
    if (candidate.resumeFileKey) {
      resumeUrl = await fileService.url(candidate.resumeFileKey);
    }

    return { ...candidate, resumeUrl };
  },

  async addRound(
    id: string,
    roundInput: InterviewRoundInput,
    ctx: RequestContext
  ) {
    const filter: Record<string, any> = { _id: id, deletedAt: null };
    const candidate = await CandidateModel.findOne(filter);
    if (!candidate) throw new NotFoundError('Candidate not found');

    const nextRoundNumber =
      roundInput.roundNumber ||
      (candidate.interviewRounds && candidate.interviewRounds.length > 0
        ? candidate.interviewRounds.length + 1
        : 1);

    const newRound = {
      roundNumber: nextRoundNumber,
      roundName: roundInput.roundName || `Round ${nextRoundNumber}`,
      interviewDate: roundInput.interviewDate,
      interviewedBy: toObjectId(roundInput.interviewedBy),
      notes: roundInput.notes || null,
      status: roundInput.status || 'Scheduled',
    };

    candidate.interviewRounds = candidate.interviewRounds || [];
    candidate.interviewRounds.push(newRound as any);

    // Also update candidate's latest interview info
    candidate.interviewDate = roundInput.interviewDate;
    candidate.interviewedBy = toObjectId(roundInput.interviewedBy);
    if (roundInput.status && roundInput.status !== 'Scheduled') {
      candidate.status = roundInput.status as any;
    }
    candidate.updatedBy = toObjectId(ctx.user.id);

    await candidate.save();

    const populated = await CandidateModel.findById(candidate._id)
      .populate('interviewedBy', 'name email role')
      .populate('interviewRounds.interviewedBy', 'name email role')
      .lean();

    let resumeUrl: string | null = null;
    if (populated?.resumeFileKey) {
      resumeUrl = await fileService.url(populated.resumeFileKey);
    }

    return { ...populated, resumeUrl };
  },

  async updateRound(
    id: string,
    roundId: string,
    roundInput: Partial<InterviewRoundInput>,
    ctx: RequestContext
  ) {
    const filter: Record<string, any> = { _id: id, deletedAt: null };
    const candidate = await CandidateModel.findOne(filter);
    if (!candidate) throw new NotFoundError('Candidate not found');

    const round = candidate.interviewRounds?.find((r: any) => String(r._id) === String(roundId));
    if (!round) throw new NotFoundError('Interview round not found');

    if (roundInput.roundName !== undefined) round.roundName = roundInput.roundName;
    if (roundInput.interviewDate !== undefined) round.interviewDate = roundInput.interviewDate;
    if (roundInput.interviewedBy !== undefined) round.interviewedBy = toObjectId(roundInput.interviewedBy);
    if (roundInput.notes !== undefined) round.notes = roundInput.notes;
    if (roundInput.status !== undefined) round.status = roundInput.status;
    if (roundInput.roundNumber !== undefined) round.roundNumber = roundInput.roundNumber;

    candidate.updatedBy = toObjectId(ctx.user.id);
    await candidate.save();

    const populated = await CandidateModel.findById(candidate._id)
      .populate('interviewedBy', 'name email role')
      .populate('interviewRounds.interviewedBy', 'name email role')
      .lean();

    let resumeUrl: string | null = null;
    if (populated?.resumeFileKey) {
      resumeUrl = await fileService.url(populated.resumeFileKey);
    }

    return { ...populated, resumeUrl };
  },

  async deleteRound(id: string, roundId: string, ctx: RequestContext) {
    const filter: Record<string, any> = { _id: id, deletedAt: null };
    const candidate = await CandidateModel.findOne(filter);
    if (!candidate) throw new NotFoundError('Candidate not found');

    candidate.interviewRounds = (candidate.interviewRounds || []).filter(
      (r: any) => String(r._id) !== String(roundId)
    );
    candidate.updatedBy = toObjectId(ctx.user.id);
    await candidate.save();

    const populated = await CandidateModel.findById(candidate._id)
      .populate('interviewedBy', 'name email role')
      .populate('interviewRounds.interviewedBy', 'name email role')
      .lean();

    let resumeUrl: string | null = null;
    if (populated?.resumeFileKey) {
      resumeUrl = await fileService.url(populated.resumeFileKey);
    }

    return { ...populated, resumeUrl };
  },
};
