import { runInteriorDept, runLocalidadStep, runBarrioStep } from './interior-dept';

const cfg = { deptCode: 'SJ', deptName: 'san_jose', exteriorSerie: 'OZZ', simplifyQuantile: 0.08 };
runInteriorDept(cfg);
runLocalidadStep(cfg);
runBarrioStep({ ...cfg, ciudad: 'san_jose_de_mayo', placementMin: 0.30 });
