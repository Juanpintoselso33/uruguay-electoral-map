import { runInteriorDept, runLocalidadStep, runBarrioStep } from './interior-dept';

const cfg = { deptCode: 'CL', deptName: 'cerro_largo', exteriorSerie: 'GZZ', simplifyQuantile: 0.08 };
runInteriorDept(cfg);
runLocalidadStep(cfg);
runBarrioStep({ ...cfg, ciudad: 'melo', placementMin: 0.55 });
