import express from 'express';
import {
    getAllRechargePacks,
    createRechargePack,
    updateRechargePack,
    deleteRechargePack
} from '../controllers/rechargePackController.js';
import { protect, isAdmin } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
    .get(getAllRechargePacks)
    .post(protect, isAdmin, createRechargePack);

router.route('/:id')
    .put(protect, isAdmin, updateRechargePack)
    .delete(protect, isAdmin, deleteRechargePack);



export default router;
