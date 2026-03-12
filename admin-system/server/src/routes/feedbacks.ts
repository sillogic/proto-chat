import express from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { feedbackService, type FeedbackStatus } from '../services/feedback-service';

const router: express.Router = express.Router();

router.use(authenticateToken);

// GET /api/admin/feedbacks?page=1&pageSize=20&status=pending&search=xxx
router.get('/', requirePermission('feedbacks.read'), async (req, res) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
        const status = (req.query.status as string) || 'all';
        const search = (req.query.search as string) || '';

        const result = await feedbackService.getList({ page, pageSize, search, status: status as any });
        res.json({ success: true, data: result.items, total: result.total });
    } catch (error) {
        console.error('Get feedbacks error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch feedbacks' });
    }
});

// GET /api/admin/feedbacks/:id
router.get('/:id', requirePermission('feedbacks.read'), async (req, res) => {
    try {
        const item = await feedbackService.getById(req.params.id);
        if (!item) return res.status(404).json({ success: false, message: 'Feedback not found' });
        res.json({ success: true, data: item });
    } catch (error) {
        console.error('Get feedback error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch feedback' });
    }
});

// PUT /api/admin/feedbacks/:id  — update status / adminNote
router.put('/:id', requirePermission('feedbacks.write'), async (req, res) => {
    try {
        const { status, adminNote } = req.body as { status?: FeedbackStatus; adminNote?: string };
        if (!status) return res.status(400).json({ success: false, message: 'status is required' });

        const updated = await feedbackService.updateStatus(req.params.id, status, adminNote);
        if (!updated) return res.status(404).json({ success: false, message: 'Feedback not found' });
        res.json({ success: true, data: updated });
    } catch (error) {
        console.error('Update feedback error:', error);
        res.status(500).json({ success: false, message: 'Failed to update feedback' });
    }
});

// DELETE /api/admin/feedbacks/:id
router.delete('/:id', requirePermission('feedbacks.write'), async (req, res) => {
    try {
        await feedbackService.delete(req.params.id);
        res.json({ success: true, message: 'Feedback deleted' });
    } catch (error) {
        console.error('Delete feedback error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete feedback' });
    }
});

export default router;
