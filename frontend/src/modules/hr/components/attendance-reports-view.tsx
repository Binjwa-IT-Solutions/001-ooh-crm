'use client';

import { useState, useEffect } from 'react';
import { LayoutGrid, Table, Download } from 'lucide-react';
import { useDailySummary, useLateReport, useMonthlyRegister, useAbsenceReport } from '@/modules/hr/hooks/use-reports';
import { MonthlyRegisterGrid } from '@/modules/hr/components/monthly-register-grid';
import { TeamAttendanceTable } from '@/modules/hr/components/team-attendance-table';
import { AttendanceOverviewWidget } from '@/modules/hr/components/attendance-overview-widget';
import { DEPARTMENTS } from '@/modules/employees/types';
import { cx, Dropdown, DatePicker } from '@/shared/ui';
import { reportsApi } from '@/modules/hr/api';

type ReportType = 'monthly' | 'daily' | 'late' | 'absence';

export function AttendanceReportsView() {
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [monthlyViewMode, setMonthlyViewMode] = useState<'heatmap' | 'table'>('heatmap');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Multi-month range support
  type MonthPreset = 'this_month' | 'last_3_months' | 'last_6_months' | 'custom';
  const [monthPreset, setMonthPreset] = useState<MonthPreset>('this_month');
  
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const [fromMonth, setFromMonth] = useState(currentMonth);
  const [fromYear, setFromYear] = useState(currentYear);
  const [toMonth, setToMonth] = useState(currentMonth);
  const [toYear, setToYear] = useState(currentYear);

  const [department, setDepartment] = useState<string>('');

  const daily = useDailySummary();
  const late = useLateReport();
  const monthly = useMonthlyRegister();
  const absence = useAbsenceReport();

  const handleExport = () => {
    const exportParams: Record<string, string | number | undefined> = {
      reportType,
      department: department || undefined,
    };

    if (reportType === 'daily') {
      exportParams.date = date;
    } else if (reportType === 'late' || reportType === 'absence') {
      exportParams.fromDate = fromDate;
      exportParams.toDate = toDate;
    } else if (reportType === 'monthly') {
      exportParams.fromMonth = fromMonth;
      exportParams.fromYear = fromYear;
      exportParams.toMonth = toMonth;
      exportParams.toYear = toYear;
    }

    const url = reportsApi.exportReportUrl(exportParams);
    window.open(url, '_blank');
  };

  const handlePresetChange = (preset: MonthPreset) => {
    setMonthPreset(preset);
    const d = new Date();
    const curM = d.getMonth() + 1;
    const curY = d.getFullYear();

    if (preset === 'this_month') {
      setFromMonth(curM);
      setFromYear(curY);
      setToMonth(curM);
      setToYear(curY);
    } else if (preset === 'last_3_months') {
      const past = new Date(curY, curM - 1 - 2, 1);
      setFromMonth(past.getMonth() + 1);
      setFromYear(past.getFullYear());
      setToMonth(curM);
      setToYear(curY);
    } else if (preset === 'last_6_months') {
      const past = new Date(curY, curM - 1 - 5, 1);
      setFromMonth(past.getMonth() + 1);
      setFromYear(past.getFullYear());
      setToMonth(curM);
      setToYear(curY);
    }
  };

  const handleFetch = () => {
    switch (reportType) {
      case 'daily':
        daily.fetchReport(date);
        break;
      case 'late':
        late.fetchReport(fromDate, toDate);
        break;
      case 'monthly':
        monthly.fetchReport(fromMonth, fromYear, toMonth, toYear);
        break;
      case 'absence':
        absence.fetchReport(fromDate, toDate);
        break;
    }
  };

  useEffect(() => {
    handleFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType, date, fromDate, toDate, fromMonth, fromYear, toMonth, toYear]);

  const isLoading = daily.isLoading || late.isLoading || monthly.isLoading || absence.isLoading;

  const filterByDept = (record: any) => {
    if (!department) return true;
    const emp = record.employee || record.employeeId;
    return emp?.department === department;
  };

  const filteredDaily = daily.data?.filter(filterByDept) || null;
  const filteredLate = late.data?.filter(filterByDept) || null;
  const filteredMonthly = monthly.data?.filter(filterByDept) || null;
  const filteredAbsence = absence.data?.filter(filterByDept) || null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Attendance Reports</h2>
          <p className="text-xs text-slate-500 mt-0.5">Daily, monthly registers, lateness, and absence summaries</p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-2 h-9 px-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
        >
          <Download className="h-4 w-4 text-[#6E1D1D]" />
          Export CSV
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 space-y-1.5 w-full md:w-auto">
          <label className="text-sm font-medium text-slate-700">Report Type</label>
          <Dropdown
            showArrow={false}
            value={reportType}
            onChange={(val) => setReportType(val as ReportType)}
            options={[
              { value: 'daily', label: 'Daily Summary' },
              { value: 'monthly', label: 'Monthly Register' },
              { value: 'late', label: 'Late Arrival Report' },
              { value: 'absence', label: 'Absence Report' },
            ]}
            triggerClassName="h-10 px-3 text-sm font-medium"
          />
        </div>

        <div className="flex-1 space-y-1.5 w-full md:w-auto">
          <label className="text-sm font-medium text-slate-700">Department</label>
          <Dropdown
            showArrow={false}
            value={department}
            onChange={setDepartment}
            options={[
              { value: '', label: 'All Departments' },
              ...DEPARTMENTS.map((dept) => ({ value: dept, label: dept })),
            ]}
            triggerClassName="h-10 px-3 text-sm"
          />
        </div>

        {reportType === 'daily' && (
          <div className="flex-1 space-y-1.5 w-full md:w-auto">
            <DatePicker
              label="Date"
              value={date}
              onChange={setDate}
              triggerClassName="h-10 px-3 text-sm"
            />
          </div>
        )}

        {(reportType === 'late' || reportType === 'absence') && (
          <>
            <div className="flex-1 space-y-1.5 w-full md:w-auto">
              <DatePicker
                label="From Date"
                value={fromDate}
                onChange={setFromDate}
                triggerClassName="h-10 px-3 text-sm"
              />
            </div>
            <div className="flex-1 space-y-1.5 w-full md:w-auto">
              <DatePicker
                label="To Date"
                value={toDate}
                onChange={setToDate}
                triggerClassName="h-10 px-3 text-sm"
              />
            </div>
          </>
        )}

        {reportType === 'monthly' && (
          <>
            <div className="flex-1 space-y-1.5 w-full md:w-auto min-w-[140px]">
              <label className="text-sm font-medium text-slate-700">Date Range</label>
              <Dropdown
                showArrow={false}
                value={monthPreset}
                onChange={(val) => handlePresetChange(val as MonthPreset)}
                options={[
                  { value: 'this_month', label: 'This Month' },
                  { value: 'last_3_months', label: 'Last 3 Months' },
                  { value: 'last_6_months', label: 'Last 6 Months' },
                  { value: 'custom', label: 'Custom Range' },
                ]}
                triggerClassName="h-10 px-3 text-sm font-medium"
              />
            </div>

            {monthPreset === 'this_month' && (
              <>
                <div className="flex-1 space-y-1.5 w-full md:w-auto">
                  <label className="text-sm font-medium text-slate-700">Month</label>
                  <Dropdown
                    showArrow={false}
                    value={String(fromMonth)}
                    onChange={(val) => {
                      const m = parseInt(val, 10);
                      setFromMonth(m);
                      setToMonth(m);
                    }}
                    options={Array.from({ length: 12 }, (_, i) => ({
                      value: String(i + 1),
                      label: new Date(0, i).toLocaleString('default', { month: 'long' }),
                    }))}
                    triggerClassName="h-10 px-3 text-sm"
                  />
                </div>
                <div className="flex-1 space-y-1.5 w-full md:w-auto">
                  <label className="text-sm font-medium text-slate-700">Year</label>
                  <Dropdown
                    showArrow={false}
                    value={String(fromYear)}
                    onChange={(val) => {
                      const y = parseInt(val, 10);
                      setFromYear(y);
                      setToYear(y);
                    }}
                    options={[currentYear - 1, currentYear, currentYear + 1].map((y) => ({
                      value: String(y),
                      label: String(y),
                    }))}
                    triggerClassName="h-10 px-3 text-sm"
                  />
                </div>
              </>
            )}

            {(monthPreset === 'last_3_months' || monthPreset === 'last_6_months') && (
              <div className="flex-1 space-y-1.5 w-full md:w-auto">
                <label className="text-sm font-medium text-slate-700">Selected Span</label>
                <div className="h-10 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center">
                  {new Date(fromYear, fromMonth - 1).toLocaleString('default', { month: 'short' })} {fromYear} – {new Date(toYear, toMonth - 1).toLocaleString('default', { month: 'short' })} {toYear}
                </div>
              </div>
            )}

            {monthPreset === 'custom' && (
              <>
                <div className="flex-1 space-y-1.5 w-full md:w-auto">
                  <label className="text-sm font-medium text-slate-700">From Month / Year</label>
                  <div className="flex gap-1.5">
                    <Dropdown
                      showArrow={false}
                      value={String(fromMonth)}
                      onChange={(val) => setFromMonth(parseInt(val, 10))}
                      options={Array.from({ length: 12 }, (_, i) => ({
                        value: String(i + 1),
                        label: new Date(0, i).toLocaleString('default', { month: 'short' }),
                      }))}
                      triggerClassName="h-10 px-2.5 text-xs min-w-[75px]"
                    />
                    <Dropdown
                      showArrow={false}
                      value={String(fromYear)}
                      onChange={(val) => setFromYear(parseInt(val, 10))}
                      options={[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => ({
                        value: String(y),
                        label: String(y),
                      }))}
                      triggerClassName="h-10 px-2 text-xs min-w-[65px]"
                    />
                  </div>
                </div>

                <div className="flex-1 space-y-1.5 w-full md:w-auto">
                  <label className="text-sm font-medium text-slate-700">To Month / Year</label>
                  <div className="flex gap-1.5">
                    <Dropdown
                      showArrow={false}
                      value={String(toMonth)}
                      onChange={(val) => setToMonth(parseInt(val, 10))}
                      options={Array.from({ length: 12 }, (_, i) => ({
                        value: String(i + 1),
                        label: new Date(0, i).toLocaleString('default', { month: 'short' }),
                      }))}
                      triggerClassName="h-10 px-2.5 text-xs min-w-[75px]"
                    />
                    <Dropdown
                      showArrow={false}
                      value={String(toYear)}
                      onChange={(val) => setToYear(parseInt(val, 10))}
                      options={[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => ({
                        value: String(y),
                        label: String(y),
                      }))}
                      triggerClassName="h-10 px-2 text-xs min-w-[65px]"
                    />
                  </div>
                </div>
              </>
            )}
          </>
        )}

        <button
          onClick={handleFetch}
          disabled={isLoading}
          className="h-10 px-4 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[100px]"
        >
          {isLoading ? (
            <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          ) : (
            'Generate'
          )}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px] flex flex-col relative transition-all duration-300">
        {reportType === 'monthly' && (
          <div className="flex-1 animate-in fade-in duration-300 p-4 space-y-4">
            {/* View Mode Toggle: Heatmap & Rings vs Standard Grid */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Monthly Attendance View
                </span>
                <p className="text-xs text-slate-400">
                  Switch between interactive heatmap & rings or classic register table.
                </p>
              </div>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setMonthlyViewMode('heatmap')}
                  className={cx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer',
                    monthlyViewMode === 'heatmap'
                      ? 'bg-white text-[#6E1D1D] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Heatmap & Rings
                </button>
                <button
                  type="button"
                  onClick={() => setMonthlyViewMode('table')}
                  className={cx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer',
                    monthlyViewMode === 'table'
                      ? 'bg-white text-[#6E1D1D] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  <Table className="h-3.5 w-3.5" />
                  Standard Grid
                </button>
              </div>
            </div>

            {filteredMonthly ? (
              monthlyViewMode === 'heatmap' ? (
                <AttendanceOverviewWidget
                  data={filteredMonthly}
                  fromMonth={fromMonth}
                  fromYear={fromYear}
                  toMonth={toMonth}
                  toYear={toYear}
                  showControls={false}
                />
              ) : (
                <MonthlyRegisterGrid
                  data={filteredMonthly}
                  fromMonth={fromMonth}
                  fromYear={fromYear}
                  toMonth={toMonth}
                  toYear={toYear}
                />
              )
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 py-12">
                Generate report to view data
              </div>
            )}
          </div>
        )}

        {reportType === 'daily' && (
          <div className="flex-1 p-0 animate-in fade-in duration-300">
            {filteredDaily ? (
              <TeamAttendanceTable records={filteredDaily} />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 min-h-[400px]">Generate report to view data</div>
            )}
          </div>
        )}

        {reportType === 'late' && (
          <div className="flex-1 p-0 animate-in fade-in duration-300">
            {filteredLate ? (
              <TeamAttendanceTable records={filteredLate} />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 min-h-[400px]">Generate report to view data</div>
            )}
          </div>
        )}

        {reportType === 'absence' && (
          <div className="flex-1 p-0 animate-in fade-in duration-300">
            {filteredAbsence ? (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-medium text-slate-600">Date</th>
                      <th className="px-4 py-3 font-medium text-slate-600">Employee</th>
                      <th className="px-4 py-3 font-medium text-slate-600">Department</th>
                      <th className="px-4 py-3 font-medium text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAbsence.map((row) => (
                      <tr key={`${row.employee.id}-${row.date}`} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-600">{new Date(row.date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{row.employee.fullName}</td>
                        <td className="px-4 py-3 text-slate-600">{row.employee.department}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700">
                            Absent
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredAbsence.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                          No absences found in this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 min-h-[400px]">Generate report to view data</div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
