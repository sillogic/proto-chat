import express from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { pricingService } from '../services/pricing-service';

const router = express.Router();

router.use(authenticateToken);

// GET /api/admin/models/pricing
router.get('/', requirePermission('plans.read'), async (req, res) => {
    try {
        const pricings = await pricingService.getAllPricings();
        res.json({ success: true, data: pricings });
    } catch (error) {
        console.error('Get pricings error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch pricings' });
    }
});

// POST /api/admin/models/pricing
router.post('/', requirePermission('plans.write'), async (req, res) => {
    try {
        const newPricing = await pricingService.createPricing({
            id: crypto.randomUUID(),
            ...req.body
        });
        res.json({ success: true, data: newPricing });
    } catch (error) {
        console.error('Create pricing error:', error);
        res.status(500).json({ success: false, message: 'Failed to create pricing' });
    }
});

// PUT /api/admin/models/pricing/:id
router.put('/:id', requirePermission('plans.write'), async (req, res) => {
    try {
        const updated = await pricingService.updatePricing(req.params.id, req.body);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Pricing not found' });
        }
        res.json({ success: true, data: updated });
    } catch (error) {
        console.error('Update pricing error:', error);
        res.status(500).json({ success: false, message: 'Failed to update pricing' });
    }
});

// DELETE /api/admin/models/pricing/:id
router.delete('/:id', requirePermission('plans.write'), async (req, res) => {
    try {
        await pricingService.deletePricing(req.params.id);
        res.json({ success: true, message: 'Pricing deleted' });
    } catch (error) {
        console.error('Delete pricing error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete pricing' });
    }
});

export default router;
