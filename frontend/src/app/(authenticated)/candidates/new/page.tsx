'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, ArrowLeft, Loader2, File, X } from 'lucide-react';
import { Button, Card } from '@/shared/ui';
import { useAuth } from '@/shared/auth/auth-context';
import { usePageSubTitle } from '@/shared/layout/page-header-context';
import { candidatesApi } from '@/modules/hr/api';

export default function AddCandidatePage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  usePageSubTitle('Add Candidate');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    position: '',
    interviewDate: new Date().toISOString().slice(0, 16),
    notes: '',
  });

  const [file, setFile] = useState<File | null>(null);

  if (!hasPermission('candidates.manage')) {
    return <div className="p-8 text-center text-red-500">You do not have permission to add candidates.</div>;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg'];
      if (!validTypes.includes(selectedFile.type)) {
        setError('Only PDF, JPG, and JPEG files are allowed for resumes.');
        return;
      }
      if (selectedFile.size > 5 * 1024 * 1024) {
        setError('Resume size must not exceed 5MB.');
        return;
      }
      setFile(selectedFile);
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const form = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        // Convert datetime-local to full ISO string
        if (key === 'interviewDate' && value) {
          form.append(key, new Date(value).toISOString());
        } else {
          form.append(key, value);
        }
      });

      if (file) {
        form.append('resume', file);
      }

      await candidatesApi.create(form);
      router.push('/candidates');
    } catch (err: any) {
      setError(err.message || 'Failed to create candidate');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/candidates')}
          className="p-2 -ml-2 text-slate-500 hover:text-slate-900 rounded-full hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="text-xl font-semibold text-slate-800">Add New Candidate</h2>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Full Name *</label>
              <input
                required
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-500/20 outline-none"
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Email *</label>
              <input
                required
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-500/20 outline-none"
                placeholder="john@example.com"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Mobile Number *</label>
              <input
                required
                type="tel"
                name="mobile"
                value={formData.mobile}
                onChange={handleChange}
                pattern="[6-9][0-9]{9}"
                title="10-digit Indian mobile number starting with 6-9"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-500/20 outline-none"
                placeholder="9876543210"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Position Applied For *</label>
              <input
                required
                type="text"
                name="position"
                value={formData.position}
                onChange={handleChange}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-500/20 outline-none"
                placeholder="Software Engineer"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Interview Date & Time *</label>
              <input
                required
                type="datetime-local"
                name="interviewDate"
                value={formData.interviewDate}
                onChange={handleChange}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Interview Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-500/20 outline-none resize-none"
              placeholder="Any comments or notes regarding this candidate..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Resume Upload</label>
            <div 
              className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 text-slate-400 mb-2" />
              <p className="text-sm text-slate-600 mb-1">Click to upload or drag and drop</p>
              <p className="text-xs text-slate-400">PDF, JPG or JPEG (max. 5MB)</p>
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/jpeg,image/jpg"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            
            {file && (
              <div className="mt-3 flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-2 bg-brand-50 text-brand-600 rounded-lg shrink-0">
                    <File className="h-5 w-5" />
                  </div>
                  <div className="truncate">
                    <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
                    <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="p-1.5 text-slate-400 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => router.back()} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="min-w-[120px]">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Candidate'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
