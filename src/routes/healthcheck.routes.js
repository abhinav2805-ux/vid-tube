import {Router} from 'express';

import {healthcheck} from "../controllers/healthcheck.controller.js"


const router =  Router();
// /api/v1/healthcheck/test

router.route("/").get(healthcheck)


export default router;
