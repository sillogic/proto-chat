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

    getTransactions = async (params: { limit?: number; mo?: string, offset?: number; } = {}) => {
        return lambdaClient.usage.getTransactions.query(params);
    }

    getUsageDetails = async (params: { limit?: number; mo?: string, offset?: number; } = {}) => {
        return lambdaClient.usage.getUsageDetails.query(params);
    }
}

export const usageService = new UsageService();