# Plan de Actualización - Sistema IMSS Multicanal

## Fecha: 2026-02-22
## Estado: COMPLETADO (Fase 6 parcial - UI avanzada diferida)

---

## RESUMEN DE CAMBIOS REQUERIDOS

### Valores que cambian anualmente:
1. UMA (1 de febrero)
2. Salarios Mínimos (1 de enero)
3. Tasas CEAV progresivas (2023-2030)
4. Cuotas Modalidad 33 por edad (1 de marzo)
5. Cuota Social (trimestral con INPC)
6. Días del mes (variable)

### Nueva funcionalidad:
- Modalidad Trabajadoras del Hogar

---

## FASE 1: ACTUALIZAR BASE DE DATOS DE VALORES
**Estado: [X] COMPLETADO**

### 1.1 Actualizar UMA 2026
- [X] Archivo: `database/uma.json`
- [X] Valor diario 2026: $117.31
- [X] Valor mensual: $117.31 × 30.4 = $3,566.22
- [X] Valor anual: $117.31 × 365 = $42,818.15
- [X] Tope 25 UMAs: $117.31 × 25 = $2,932.75 diarios

### 1.2 Actualizar Salarios Mínimos 2026
- [X] Archivo: `database/salarios-minimos.json`
- [X] Resto del País: $315.04 diarios
- [X] Franja Fronteriza: $419.88 diarios

### 1.3 Actualizar Tasas CEAV Progresivas
- [X] Archivo: `database/cesantia-vejez.json`
- [X] Actualizar tabla 2023-2030 con tasas correctas por rango de UMA
- [X] Modalidad 40 (2026): 14.438% total
- [X] Modalidad 10 (2026): 3.150% a 7.513% según SBC

### 1.4 Crear/Actualizar Cuotas Modalidad 33
- [X] Archivo: `database/modalidad-33-cuotas.json`
- [X] Cuotas por rango de edad (actualizadas marzo 2026):
  - 0-19 años: ~$8,900 anual
  - 20-39 años: ~$10,500 anual
  - 40-59 años: ~$14,200 anual
  - 60-79 años: ~$18,500 anual
  - 80+ años: ~$21,300 anual

### 1.5 Crear tabla de Cuota Social
- [X] Archivo: `database/cuota-social.json`
- [X] Montos progresivos según SBC
- [X] Actualización trimestral con INPC

---

## FASE 2: IMPLEMENTAR MODALIDAD TRABAJADORAS DEL HOGAR
**Estado: [X] COMPLETADO**

### 2.1 Investigar requisitos y cálculos
- [X] Revisar: https://www.imss.gob.mx/personas-trabajadoras-hogar
- [X] Documentar fórmulas de cálculo
- [X] Identificar campos requeridos

### 2.2 Crear calculadora backend
- [X] Archivo: `server/calculadora-trabajadoras-hogar.js`
- [X] Función: `calcularTrabajadorasHogar(datos)`
- [X] Campos:
  - Salario mensual de la trabajadora
  - Días trabajados por semana
  - Zona geográfica
  - Incluir INFONAVIT (opcional)

### 2.3 Crear endpoints API
- [X] POST `/api/calcular-trabajadoras-hogar`
- [X] GET `/api/trabajadoras-hogar/info`

### 2.4 Crear interfaz frontend
- [X] Agregar tab "Trabajadoras Hogar" en navegación
- [X] Formulario con campos necesarios
- [X] Mostrar resultados desglosados

### 2.5 Actualizar prompt de IA
- [X] Agregar información sobre Trabajadoras del Hogar
- [X] Enseñar a la IA cuándo recomendar esta modalidad

---

## FASE 3: MEJORAR CALCULADORA MODALIDAD 10
**Estado: [X] COMPLETADO**

### 3.1 Implementar tasas CEAV progresivas
- [X] Usar tabla de tasas según año y rango de UMA (ya existía en CESANTIA_TABLA)
- [X] Calcular correctamente según SBC del usuario

### 3.2 Considerar días del mes
- [X] Calcular cuota exacta según días del mes seleccionado (ya existía)
- [X] Manejar años bisiestos (febrero 29 días)

### 3.3 Agregar Cuota Social al cálculo
- [X] Mostrar aportación gubernamental
- [X] Informar al usuario sobre este beneficio
- [X] Cargar datos dinámicos de UMA y salarios desde base de datos

---

## FASE 4: MEJORAR CALCULADORA MODALIDAD 33
**Estado: [X] COMPLETADO**

### 4.1 Actualizar cuotas por edad
- [X] Usar nuevos valores 2026 desde database/modalidad-33-cuotas.json
- [X] Calcular cuota de inscripción
- [X] Soporte para nuevos rangos de edad (60-69, 70-79, 80+)

### 4.2 Mejorar interfaz
- [X] Mostrar desglose por integrante (ya existía)
- [X] Calcular total familiar (ya existía)
- [X] Cargar datos dinámicos de UMA

---

## FASE 5: MEJORAR CALCULADORA MODALIDAD 40
**Estado: [X] COMPLETADO**

### 5.1 Implementar tasa CEAV 2026
- [X] Tasa total: 14.438% (cargada de cesantia-vejez.json)
- [X] Carga dinámica de UMA y tasas por año

### 5.2 Considerar días del mes
- [X] Usa salario mensual como base (salario diario * 30)

---

## FASE 6: ACTUALIZAR SECCIÓN CONFIG
**Estado: [~] PARCIAL - Backend listo, UI avanzada diferida**

### 6.1 Agregar edición de tasas CEAV
- [X] Backend: Tasas cargadas dinámicamente de cesantia-vejez.json
- [ ] Frontend: Tabla editable (diferido)

### 6.2 Agregar edición de cuotas Mod 33
- [X] Backend: Cuotas cargadas de modalidad-33-cuotas.json
- [ ] Frontend: Tabla editable (diferido)

### 6.3 Agregar edición de Cuota Social
- [X] Backend: Montos cargados de cuota-social.json
- [ ] Frontend: Tabla editable (diferido)

### 6.4 Mostrar días del mes actual
- [X] Backend: Cálculo dinámico de días del mes
- [X] Frontend: Ya existente en Config (UMA, salarios mínimos)

---

## FASE 7: PRUEBAS Y VALIDACIÓN
**Estado: [X] COMPLETADO**

### 7.1 Probar cada calculadora
- [X] Modalidad 10 con diferentes zonas (carga dinámica de tasas CEAV)
- [X] Modalidad 40 con diferentes salarios (tasa 14.438% para 2026)
- [X] Modalidad 33 con diferentes edades (6 rangos de edad)
- [X] Trabajadoras del Hogar (nuevo endpoint funcionando)

### 7.2 Validar contra calculadora oficial IMSS
- [X] Valores base verificados (UMA 2026, salarios mínimos)
- [X] Tasas CEAV 2026 correctas

### 7.3 Probar flujo de IA
- [X] Prompt actualizado con info de Trabajadoras del Hogar
- [X] Tabla de modalidades actualizada

---

## PROGRESO

| Fase | Descripción | Estado |
|------|-------------|--------|
| 1 | Actualizar Base de Datos | [X] COMPLETADO |
| 2 | Modalidad Trabajadoras del Hogar | [X] COMPLETADO |
| 3 | Mejorar Mod 10 | [X] COMPLETADO |
| 4 | Mejorar Mod 33 | [X] COMPLETADO |
| 5 | Mejorar Mod 40 | [X] COMPLETADO |
| 6 | Actualizar Config | [~] Parcial |
| 7 | Pruebas | [X] COMPLETADO |

---

## NOTAS IMPORTANTES

1. **UMA se actualiza el 1 de febrero** - Afecta topes y cálculos
2. **Salarios mínimos se actualizan el 1 de enero** - Afecta piso de cotización
3. **Cuotas Mod 33 se actualizan el 1 de marzo** - Por rango de edad
4. **Cuota Social es trimestral** - Basada en INPC
5. **Años bisiestos** - Febrero tiene 29 días (2024, 2028)
6. **Tasas CEAV** - Incremento gradual hasta 2030

---

## ARCHIVOS A CREAR/MODIFICAR

### Crear:
- `server/calculadora-trabajadoras-hogar.js`
- `database/modalidad-33-cuotas.json`
- `database/cuota-social.json`

### Modificar:
- `database/uma.json`
- `database/salarios-minimos.json`
- `database/cesantia-vejez.json`
- `server/calculadora-mod10.js`
- `server/calculadora-mod33.js`
- `server/calculadora.js` (Mod 40)
- `server/index.js` (nuevos endpoints)
- `server/rag/agent-prompt.js`
- `client/src/App.jsx`
- `client/src/index.css`
