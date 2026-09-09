import {Router,type Request,type Response} from 'express';
import { trucks } from '../services/trucks.js';

const router = Router();

//GET /api/vehicles -> current position +status of all 3 trucks,

router.get('/',(_req:Request, res:Response)=>{
    res.json({vehicles:[...trucks.values()]});
})

export default router;

