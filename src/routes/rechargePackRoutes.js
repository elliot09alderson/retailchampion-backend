import express from 'express';
import {
    getAllRechargePacks,
    createRechargePack,
    updateRechargePack,
    deleteRechargePack
} from '../controllers/rechargePackController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(getAllRechargePacks)
    .post(protect, admin, createRechargePack);

router.route('/:id')
    .put(protect, admin, updateRechargePack)
    .delete(protect, admin, deleteRechargePack);



export default router;
