export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    
    'type-case': [2, 'always', 'lower-case'],
    'subject-empty': [2, 'never'],
    'type-enum': [
      2,
      'always',
      [
        'feat',     // Nueva funcionalidad (ej. crear un endpoint)
        'fix',      // Arreglo de bug
        'docs',     // Documentación (README, Swagger)
        'style',    // Formato (espacios, comas)
        'refactor', // Mejora de código sin cambiar lógica
        'test',     // Tests
        'chore',    // Mantenimiento (deps, docker, configs)
        'perf',     // Rendimiento
        'ci',       // Integración continua
        'revert'    // Revertir cambios
      ],
    ],
  },
};