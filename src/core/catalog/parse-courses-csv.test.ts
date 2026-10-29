import { describe, expect, it } from "vitest";
import { parseCoursesCsv } from "./parse-courses-csv";

const HEADER = "﻿Nombre,Estado,Duración,Enlace,Imagen";

describe("parseCoursesCsv", () => {
  it("maps each scraped row to a course with slug, status and hours", () => {
    const csv = [
      HEADER,
      "INTRODUCCIÓN A LAS REDES – PREPARACIÓN CCNA,ABIERTO,70 HORAS,https://ctt-talleresfisei.uta.edu.ec/curso16.php,https://ctt-talleresfisei.uta.edu.ec/img/curso16.jpg",
      "JavaScript Essentials 1,CERRADO,40 HORAS,https://ctt-talleresfisei.uta.edu.ec/curso3.php,https://ctt-talleresfisei.uta.edu.ec/img/javascript1.jpg",
    ].join("\n");

    expect(parseCoursesCsv(csv)).toEqual([
      {
        slug: "curso16",
        name: "INTRODUCCIÓN A LAS REDES – PREPARACIÓN CCNA",
        status: "open",
        trainingHours: 70,
        url: "https://ctt-talleresfisei.uta.edu.ec/curso16.php",
        imageUrl: "https://ctt-talleresfisei.uta.edu.ec/img/curso16.jpg",
        fullTitle: null,
        description: null,
        objectives: null,
        location: null,
        organizers: null,
        details: null,
      },
      {
        slug: "curso3",
        name: "JavaScript Essentials 1",
        status: "closed",
        trainingHours: 40,
        url: "https://ctt-talleresfisei.uta.edu.ec/curso3.php",
        imageUrl: "https://ctt-talleresfisei.uta.edu.ec/img/javascript1.jpg",
        fullTitle: null,
        description: null,
        objectives: null,
        location: null,
        organizers: null,
        details: null,
      },
    ]);
  });

  it("keeps commas inside quoted names", () => {
    const csv = [
      HEADER,
      '"ARDUINO DESDE CERO: ELECTRÓNICA, PROGRAMACIÓN Y AUTOMATIZACIÓN",ABIERTO,40 HORAS,https://x.ec/curso13.php,https://x.ec/img/arduino.png',
    ].join("\r\n");

    expect(parseCoursesCsv(csv)[0].name).toBe(
      "ARDUINO DESDE CERO: ELECTRÓNICA, PROGRAMACIÓN Y AUTOMATIZACIÓN",
    );
  });

  it("returns null hours when the duration is not available", () => {
    const csv = [HEADER, "Curso X,ABIERTO,No disponible,https://x.ec/curso99.php,"].join("\n");

    const [course] = parseCoursesCsv(csv);
    expect(course.trainingHours).toBeNull();
    expect(course.imageUrl).toBeNull();
  });

  it("reads the detail columns of the full scrape and strips their section headings", () => {
    const csv = [
      "\uFEFFNombre,Estado,Duración,Enlace,Imagen,Titulo completo,Introducción,Objetivos,Ubicación,Organización,Requisitos y contenidos",
      [
        "FUNDAMENTOS DE PYTHON 2,ABIERTO,40 HORAS,https://x.ec/curso21.php,https://x.ec/img/curso21.jpg",
        "Fundamentos de Python 2",
        '"DESCRIPCIÓN DEL CURSO Continúa con módulos, paquetes y excepciones."',
        "OBJETIVOS Aplicar programación orientada a objetos.",
        '"LUGAR DE CELEBRACIÓN Virtual, plataforma Cisco NetAcad."',
        "COMITÉ ORGANIZADOR Ing. Carlos Vargas",
        '"REQUISITOS Y DETALLES MATERIALES Y EQUIPOS CONTENIDOS Fechas de inscripciones: Del 30 de octubre de 2026 al 15 de noviembre de 2026 Precio para los asistentes: Estudiantes UTA: $40,00 Graduados UTA: $50,00 Público en general: $60,00"',
      ].join(","),
    ].join("\n");

    const [course] = parseCoursesCsv(csv);
    expect(course).toMatchObject({
      slug: "curso21",
      fullTitle: "Fundamentos de Python 2",
      description: "Continúa con módulos, paquetes y excepciones.",
      objectives: "Aplicar programación orientada a objetos.",
      location: "Virtual, plataforma Cisco NetAcad.",
      organizers: "COMITÉ ORGANIZADOR Ing. Carlos Vargas",
      details: {
        enrollmentStart: "2026-10-30",
        enrollmentEnd: "2026-11-15",
        prices: { utaStudent: 40, utaStaff: 50, public: 60 },
      },
    });
  });
});
