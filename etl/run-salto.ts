import { runInteriorDept, runLocalidadStep, runBarrioStep } from './interior-dept';

const cfg = { deptCode: 'SA', deptName: 'salto', exteriorSerie: 'JZZ', simplifyQuantile: 0.08 };
runInteriorDept(cfg);
runLocalidadStep(cfg);
runBarrioStep({ ...cfg, ciudad: 'salto' });
