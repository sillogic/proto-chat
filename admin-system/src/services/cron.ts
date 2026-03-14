import { request } from '@umijs/max';

export interface CronJobLog {
    id: string;
    jobName: string;
    jobPath: string;
    status: 'success' | 'error';
    result?: Record<string, any>;
    error?: string;
    durationMs?: number;
    createdAt: string;
}

export interface GetCronLogsParams {
    jobName?: string;
    status?: string;
    limit?: number;
    days?: number;
}

export async function getCronJobLogs(params?: GetCronLogsParams) {
    return request<{ data: CronJobLog[]; success: boolean }>('/api/admin/cron-logs', {
        method: 'GET',
        params,
    });
}
