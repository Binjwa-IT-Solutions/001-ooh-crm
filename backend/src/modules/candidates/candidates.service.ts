import mongoose from 'mongoose';
import type { RequestContext } from '../../core/context.js';
import { toObjectId } from '../../core/db/basePlugin.js';
import { NotFoundError } from '../../core/errors/index.js';
import { fileService } from '../../core/files/index.js';
import { CandidateModel, type Candidate } from './candidates.model.js';
import type { CreateCandidateInput, ListCandidatesQuery, UpdateCandidateInput } from './candidates.validator.js';

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

    const candidate = await CandidateModel.create({
      ...input,
      interviewedBy: toObjectId(ctx.user.id),
      resumeFileKey,
      createdBy: toObjectId(ctx.user.id),
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

    if (query.startDate || query.endDate) {
      filter.interviewDate = {};
      if (query.startDate) filter.interviewDate.$gte = query.startDate;
      if (query.endDate) filter.interviewDate.$lte = query.endDate;
    }

    const total = await CandidateModel.countDocuments(filter);
    const data = await CandidateModel.find(filter)
      .populate('interviewedBy', 'name')
      .sort({ [query.sortBy]: query.sortDir === 'desc' ? -1 : 1 })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .lean();

    return { data, total, page: query.page, pageSize: query.pageSize };
  },

  async getById(id: string, ctx: RequestContext) {
    const filter: Record<string, any> = { _id: id, deletedAt: null };
    const candidate = await CandidateModel.findOne(filter)
      .populate('interviewedBy', 'name')
      .lean();

    if (!candidate) throw new NotFoundError('Candidate not found');

    let resumeUrl: string | null = null;
    if (candidate.resumeFileKey) {
      resumeUrl = await fileService.url(candidate.resumeFileKey);
    }

    return { ...candidate, resumeUrl };
  },

  async update(id: string, input: UpdateCandidateInput, ctx: RequestContext) {
    const filter: Record<string, any> = { _id: id, deletedAt: null };

    const candidate = await CandidateModel.findOneAndUpdate(
      filter,
      { $set: { ...input, updatedBy: toObjectId(ctx.user.id) } },
      { new: true }
    )
      .populate('interviewedBy', 'name')
      .lean();

    if (!candidate) throw new NotFoundError('Candidate not found');

    let resumeUrl: string | null = null;
    if (candidate.resumeFileKey) {
      resumeUrl = await fileService.url(candidate.resumeFileKey);
    }

    return { ...candidate, resumeUrl };
  },
};
