import { describe, expect, it } from 'vitest';
import { borradorValido, CITA, refDesempeno, TEXTO_OFICIAL } from './pruebas-util.ts';
import { anonimizar, extraerNumeros, normalizar } from './texto.ts';
import { citaLiteral, verificarBorrador, type ContextoVerificacion } from './verificador.ts';

const ctx: ContextoVerificacion = {
  desempeno: refDesempeno,
  textoOficial: () => TEXTO_OFICIAL,
};
const reglas = (b = borradorValido()) => verificarBorrador(b, ctx).hallazgos.map((h) => h.regla);

describe('texto', () => {
  it('normalizes accents, case and punctuation', () => {
    expect(normalizar('  Péndulo,  ¡MÁS!  ')).toBe('pendulo mas');
  });
  it('extracts numbers with comma or dot decimals', () => {
    expect(extraerNumeros('Mide 1,9 s y 0.5 m; luego 10')).toEqual([1.9, 0.5, 10]);
  });
  it('anonymizes phones, emails, ids and common names', () => {
    const t = anonimizar('Escribe a juan@mail.com o al 987 654 321, DNI 12345678, María lo sabe');
    expect(t).not.toMatch(/juan@|987|12345678|María/);
  });
});

describe('citaLiteral', () => {
  it('accepts an exact substring', () => {
    expect(citaLiteral(CITA, TEXTO_OFICIAL)).toBe(true);
  });
  it('rejects a quote altered by one letter', () => {
    expect(citaLiteral(CITA.replace('influyen', 'influyan'), TEXTO_OFICIAL)).toBe(false);
    expect(citaLiteral(CITA.slice(0, -1) + 'ó', TEXTO_OFICIAL)).toBe(false);
  });
  it('is case and accent sensitive', () => {
    expect(citaLiteral(CITA.toLowerCase(), TEXTO_OFICIAL)).toBe(false);
  });
  it('rejects quotes shorter than 20 characters', () => {
    expect(citaLiteral('Formula preguntas', TEXTO_OFICIAL)).toBe(false);
  });
});

describe('verificarBorrador (gates 5.4)', () => {
  it('accepts a valid draft', () => {
    const r = verificarBorrador(borradorValido(), ctx);
    expect(r.hallazgos).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('rejects a draft whose quote is altered by one letter', () => {
    const b = borradorValido();
    b.citaDesempeno = CITA.replace('Formula', 'Formulo');
    expect(reglas(b)).toContain('cita_literal');
  });

  it('rejects a CNEB quote that no retrieved chunk contains (RAG grounding)', () => {
    const sin = verificarBorrador(borradorValido(), { ...ctx, recuperados: [{ texto: 'Otro desempeño sin relación.' }] });
    expect(sin.hallazgos.map((h) => h.regla)).toContain('cneb_sin_fundamento');
    const con = verificarBorrador(borradorValido(), { ...ctx, recuperados: [{ texto: TEXTO_OFICIAL }] });
    expect(con.hallazgos.map((h) => h.regla)).not.toContain('cneb_sin_fundamento');
  });

  it('fails closed when the official text is unknown', () => {
    const r = verificarBorrador(borradorValido(), { ...ctx, textoOficial: () => undefined });
    expect(r.ok).toBe(false);
    expect(r.hallazgos.map((h) => h.regla)).toContain('desempeno_inexistente');
  });

  it('rejects a hint with the numeric result (comma or dot)', () => {
    for (const pista of ['Con 0,9 m el periodo es de 1,9 s.', 'Debería salir 1.55 segundos.']) {
      const b = borradorValido();
      b.pistas[2] = pista;
      expect(reglas(b)).toContain('pista_revela');
    }
  });

  it('does not flag input values or unrelated numbers in a hint', () => {
    const b = borradorValido();
    b.pistas[1] = 'Usa cuerdas de 0,3 m y 0,9 m con 10 vueltas cada una.';
    expect(reglas(b)).not.toContain('pista_revela');
  });

  it('rejects a hint that states the expected conclusion', () => {
    const b = borradorValido();
    b.pistas[2] = 'Recuerda: el periodo aumenta cuando aumenta la longitud de la cuerda.';
    expect(reglas(b)).toContain('pista_revela');
  });

  it('rejects a hint with a forbidden phrase', () => {
    const b = borradorValido();
    b.resultadoEsperado.frasesProhibidas = ['la masa no influye'];
    b.pistas[1] = 'Fíjate que la masa no influye en nada.';
    expect(reglas(b)).toContain('pista_revela');
  });

  it('rejects a quiz whose statement reveals the correct option', () => {
    const b = borradorValido();
    b.quiz![0]!.enunciado = 'El tiempo de cada vuelta disminuye al acortar la cuerda: ¿qué pasa? Disminuye';
    expect(reglas(b)).toContain('quiz_revela');
  });

  it('rejects a quiz statement with the numeric result', () => {
    const b = borradorValido();
    b.quiz![0]!.enunciado = 'Con 0,9 m el periodo es 1,9 s, ¿qué pasa si acortas la cuerda?';
    expect(reglas(b)).toContain('quiz_revela');
  });

  it('rejects a quiz with an out-of-range correct index or duplicated options', () => {
    const b = borradorValido();
    b.quiz![0]!.correcta = 7;
    expect(reglas(b)).toContain('quiz_invalido');
    const c = borradorValido();
    c.quiz![0]!.opciones = ['Igual', 'igual', 'Menos'];
    expect(reglas(c)).toContain('quiz_invalido');
  });

  it('rejects emotional vocabulary about the student', () => {
    for (const texto of ['Si te sientes frustrado, respira.', 'No te preocupes si estás aburrido.', 'Un alumno ansioso puede pedir ayuda.']) {
      const b = borradorValido();
      b.pistas[0] = texto;
      expect(reglas(b)).toContain('vocabulario_afectivo');
    }
  });

  it('scans emotional vocabulary in the video script too', () => {
    const b = borradorValido();
    b.guionVideo = ['Un estudiante triste mira el péndulo.'];
    expect(reglas(b)).toContain('vocabulario_afectivo');
  });

  it('rejects unsafe materials', () => {
    for (const nombre of ['Vela encendida', 'Ácido de batería', 'Cable al enchufe de 220 V', 'Fuego abierto']) {
      const b = borradorValido();
      b.materiales.push({ nombre, casero: true });
      expect(reglas(b)).toContain('material_inseguro');
    }
  });

  it('requires limitations', () => {
    const b = borradorValido();
    b.limitaciones = [' '];
    expect(reglas(b)).toContain('limitaciones');
  });

  it('rejects sentences too long for the grade', () => {
    const b = borradorValido();
    b.preguntaGuia = Array(40).fill('palabra').join(' ') + '?';
    expect(reglas(b)).toContain('nivel_lectura');
  });

  it('rejects personal data in the draft', () => {
    const b = borradorValido();
    b.pistas[0] = 'Llama al 987654321 para ayuda.';
    expect(reglas(b)).toContain('datos_personales');
  });

  it('rejects unsafe SVG', () => {
    const malos = [
      '<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>',
      '<svg viewBox="0 0 1 1" onload="x()"></svg>',
      '<svg viewBox="0 0 1 1"><image href="https://x.y/a.png"/></svg>',
      '<div></div>',
    ];
    for (const svg of malos) {
      const b = borradorValido();
      b.diagrama = { svg, etiquetas: {} };
      expect(reglas(b)).toContain('svg_inseguro');
    }
  });

  it('rejects incoherent variables', () => {
    const b = borradorValido();
    b.variables[0]!.min = 5;
    expect(reglas(b)).toContain('variables');
  });
});
