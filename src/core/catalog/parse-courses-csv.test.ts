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
      },
      {
        slug: "curso3",
        name: "JavaScript Essentials 1",
        status: "closed",
        trainingHours: 40,
        url: "https://ctt-talleresfisei.uta.edu.ec/curso3.php",
        imageUrl: "https://ctt-talleresfisei.uta.edu.ec/img/javascript1.jpg",
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
});
