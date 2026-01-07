import express from 'express';
import { authenticateToken, requirePermission, AuthenticatedRequest } from '../middleware/auth';
import { subscriptionService } from '../services/subscription-service';
import { z } from 'zod';

const router: express.Router = express.Router();

router.use(authenticateToken);

// GET /api/admin/plans
router.get('/', requirePermission('plans.read'), async (req, res) => {
    try {
        const plans = await subscriptionService.getAllPlans();
        res.json({ success: true, data: plans });
    } catch (error) {
        console.error('Get plans error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch plans' });
    }
});

// GET /api/admin/plans/:id
router.get('/:id', requirePermission('plans.read'), async (req, res) => {
    try {
        const plan = await subscriptionService.getPlanById(req.params.id);
        if (!plan) {
            return res.status(404).json({ success: false, message: 'Plan not found' });
        }
        res.json({ success: true, data: plan });
    } catch (error) {
        console.error('Get plan error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch plan' });
    }
});

// POST /api/admin/plans
router.post('/', requirePermission('plans.write'), async (req, res) => {
    try {
        // Simple validation using Zod
        // Note: ID generation handle by DB or Service if missing.
        // We'll trust the input for now but in prod validation is needed.
        const newPlan = await subscriptionService.createPlan({
            id: crypto.randomUUID(), // Generator
            ...req.body
        });
        res.json({ success: true, data: newPlan });
    } catch (error) {
        console.error('Create plan error:', error);
        res.status(500).json({ success: false, message: 'Failed to create plan' });
    }
});

// PUT /api/admin/plans/:id
router.put('/:id', requirePermission('plans.write'), async (req, res) => {
    try {
        const updated = await subscriptionService.updatePlan(req.params.id, req.body);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Plan not found' });
        }
        res.json({ success: true, data: updated });
    } catch (error) {
        console.error('Update plan error:', error);
        res.status(500).json({ success: false, message: 'Failed to update plan' });
    }
});

// DELETE /api/admin/plans/:id
router.delete('/:id', requirePermission('plans.write'), async (req, res) => {
    try {
        await subscriptionService.deletePlan(req.params.id);
        res.json({ success: true, message: 'Plan deleted' });
    } catch (error) {
        console.error('Delete plan error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete plan' });
    }
});

export default router;
