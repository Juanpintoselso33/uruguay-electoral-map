import { runInteriorDept, runLocalidadStep, runBarrioStep } from './interior-dept';

const cfg = { deptCode: 'PA', deptName: 'paysandu', exteriorSerie: 'KZZ', simplifyQuantile: 0.05 };
runInteriorDept(cfg);
runLocalidadStep(cfg);
runBarrioStep({ ...cfg, ciudad: 'paysandu' });
