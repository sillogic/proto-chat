import { lambdaClient } from "@/libs/trpc/client";

class UsageService {
    findByMonth = async (mo?: string) => {
        return lambdaClient.usage.findByMonth.query({ mo });
    };

    findAndGroupByDay = async (mo?: string) => {
        return lambdaClient.usage.findAndGroupByDay.query({ mo });
    }

    getAccountStatistics = async (params: { mo?: string } = {}) => {
        return lambdaClient.usage.getAccountStatistics.query(params);
    }

    getConsumptionDetails = async (params: {
        dateFrom?: string;
        dateTo?: string;
        limit?: number;
        model?: string;
        offset?: number;
        type?: string;
    } = {}) => {
        return lambdaClient.usage.getConsumptionDetails.query(params);
    }

    getTransactions = async (params: {
        dateFrom?: string;
        dateTo?: string;
        limit?: number;
        mo?: string;
        offset?: number;
    } = {}) => {
        return lambdaClient.usage.getTransactions.query(params);
    }

    getUsageDetails = async (params: { limit?: number; mo?: string, offset?: number; } = {}) => {
        return lambdaClient.usage.getUsageDetails.query(params);
    }
}

export const usageService = new UsageService();