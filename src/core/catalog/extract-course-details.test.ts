import { describe, expect, it } from "vitest";
import { extractCourseDetails } from "./extract-course-details";

const CCNA_2026 =
  "REQUISITOS Y DETALLES MATERIALES Y EQUIPOS CONTENIDOS Fechas de inscripciones: Del 01 de octubre de 2026 al 15 de octubre de 2026 " +
  "Cupo de inscripciones: Mínimo 5, máximo 20 Lugar del evento: Talleres Tecnológicos FISEI, Campus Huachi, Ambato; sesiones virtuales según cronograma. " +
  "Fecha del curso: Del 16 de octubre de 2026 al 05 de diciembre de 2026 Horario: Sesiones virtuales los viernes de 19:00 a 21:00 y sesiones presenciales los sábados de 08:00 a 13:00, más trabajo autónomo, según la planificación. " +
  "Precio para los asistentes: Estudiantes UTA (hasta último período): $120,00 Graduados, docentes y personal administrativo UTA: $150,00 Público en general: $180,00 " +
  "Tipo de capacitación: Certificado digital de aprobación con validación QR. Horas de capacitación: 70 horas " +
  "Beneficiarios: Estudiantes, graduados, docentes y público en general Modalidad: Híbrida Conocimientos previos: Ninguno. " +
  "Computador personal Módulo 1: Networking Today Módulo 2: Basic Switch and End Device Configuration";

const JS2_2025 =
  "REQUISITOS Y DETALLES MATERIALES Y EQUIPOS CONTENIDOS Modalidad: Curso virtual auto-didacta (Self-paced) Horas de capacitación: 50 horas " +
  "Fecha del curso: 05-abril a 04-mayo-2025 Período de inscripción: 01-marzo a 08-abril-2025 " +
  "Precio: 40 USD Estudiantes UTA 50 USD Graduados, Docentes y Administrativos UTA 60 USD Público en general Conocimientos previos: JavaScript.";

const PYTHON1_2025 =
  "REQUISITOS Y DETALLES MATERIALES Y EQUIPOS CONTENIDOS Fechas de inscripciones: 15 de febrero al 02 de marzo de 2025 " +
  "Fecha del curso: Del 01 de marzo al 30 de marzo de 2025 Horario: A elección del participante " +
  "Precio para los asistentes: 30 USD Estudiantes UTA (Último periodo) 40 USD Graduados 50 USD Público en general " +
  "Modalidad: Virtual auto-didacta (Self-paced) • Computador personal • Módulo 1: Introducción a Python";

describe("extractCourseDetails", () => {
  it("extracts dates, schedule, tiered prices, modality and certificate from the 2026 layout", () => {
    expect(extractCourseDetails(CCNA_2026)).toEqual({
      enrollmentStart: "2026-10-01",
      enrollmentEnd: "2026-10-15",
      startDate: "2026-10-16",
      endDate: "2026-12-05",
      schedule:
        "Sesiones virtuales los viernes de 19:00 a 21:00 y sesiones presenciales los sábados de 08:00 a 13:00, más trabajo autónomo, según la planificación.",
      modality: "Híbrida",
      certificate: "Certificado digital de aprobación con validación QR.",
      prices: { utaStudent: 120, utaStaff: 150, public: 180 },
      text: CCNA_2026.replace("REQUISITOS Y DETALLES MATERIALES Y EQUIPOS CONTENIDOS ", ""),
    });
  });

  it("reads the 2025 layout with 'Período de inscripción' and short 'Precio' label", () => {
    expect(extractCourseDetails(JS2_2025)).toMatchObject({
      enrollmentStart: "2025-03-01",
      enrollmentEnd: "2025-04-08",
      startDate: "2025-04-05",
      endDate: "2025-05-04",
      schedule: null,
      modality: "Curso virtual auto-didacta (Self-paced)",
      certificate: null,
      prices: { utaStudent: 40, utaStaff: 50, public: 60 },
    });
  });

  it("stops a value at bullet lists and module headings", () => {
    expect(extractCourseDetails(PYTHON1_2025)).toMatchObject({
      enrollmentStart: "2025-02-15",
      enrollmentEnd: "2025-03-02",
      schedule: "A elección del participante",
      modality: "Virtual auto-didacta (Self-paced)",
      prices: { utaStudent: 30, utaStaff: 40, public: 50 },
    });
  });

  it("returns null fields when labels are missing", () => {
    expect(extractCourseDetails("Sin información")).toEqual({
      enrollmentStart: null,
      enrollmentEnd: null,
      startDate: null,
      endDate: null,
      schedule: null,
      modality: null,
      certificate: null,
      prices: null,
      text: "Sin información",
    });
  });
});
