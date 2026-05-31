import { runInteriorDept, runLocalidadStep, runBarrioStep } from './interior-dept';

const cfg = { deptCode: 'DU', deptName: 'durazno', exteriorSerie: 'RZZ', simplifyQuantile: 0.05 };
runInteriorDept(cfg);
runLocalidadStep(cfg);
runBarrioStep({ ...cfg, ciudad: 'durazno', placementMin: 0.55 });
