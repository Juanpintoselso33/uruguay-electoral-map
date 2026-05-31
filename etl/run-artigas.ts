import { runInteriorDept, runLocalidadStep, runBarrioStep } from './interior-dept';

const cfg = { deptCode: 'AR', deptName: 'artigas', exteriorSerie: 'IZZ', simplifyQuantile: 0.08 };
runInteriorDept(cfg);
runLocalidadStep(cfg);
runBarrioStep({ ...cfg, ciudad: 'artigas', placementMin: 0.55 });
