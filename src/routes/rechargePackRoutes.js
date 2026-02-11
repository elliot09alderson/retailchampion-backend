import express from 'express';
import {
    getAllRechargePacks,
    createRechargePack,
    updateRechargePack,
    deleteRechargePack
} from '../controllers/rechargePackController.js';

const router = express.Router();

router.route('/')
    .get(getAllRechargePacks) // Public access for VIPs too, or specific middleware
    .post(createRechargePack); // Admin Only

router.route('/:id')
    .put(updateRechargePack) // Admin Only
    .delete(deleteRechargePack); // Admin Only

export default router;
