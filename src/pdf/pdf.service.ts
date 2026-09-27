import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as fs from 'fs';
import { join } from 'path';
import type { Browser, LaunchOptions } from 'puppeteer';

export interface LogosDocumento {
  aceaa: Buffer | null;
  amz: Buffer | null;
}

export interface OpcionesPdf {
  landscape?: boolean;
  marginMm?: number;
}

/**
 * Un documento listo para renderizar. Los servicios lo arman una sola vez y de
 * él salen tanto el PDF como la vista en pantalla: así no pueden divergir.
 */
export interface DocumentoPdf {
  plantilla: string;
  datos: object;
  opciones?: OpcionesPdf;
}

export function documentoPdf(
  plantilla: string,
  datos: object,
  opciones?: OpcionesPdf,
): DocumentoPdf {
  return { plantilla, datos, opciones };
}

/** Parciales de `templates/partials/` que comparten todos los documentos. */
const PARCIALES = ['estilos-documento', 'encabezado', 'logos'];

/** Margen uniforme de todos los documentos, vertical y apaisado. */
const MARGEN_MM = 12;

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  /**
   * Compila la plantilla a HTML. Lo usa el propio PDF y las vistas que deben
   * verse idénticas al documento impreso (p. ej. el ANEXO 2 en el detalle).
   */
  async renderHtml(templateName: string, data: any): Promise<string> {
    // Import dinámico para no cargar handlebars en startup
    const handlebars = await import('handlebars');

    // Importe en Bs para los anexos: vacío si no aplica, "-" si es cero
    handlebars.default.registerHelper('bs', (valor: unknown) => {
      if (valor === null || valor === undefined || valor === '') return '';
      const numero = Number(valor);
      if (!Number.isFinite(numero)) return '';
      if (Math.round(numero * 100) === 0) return '-';
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(numero);
    });

    // Encabezado y estilos comunes a todos los documentos
    for (const parcial of PARCIALES) {
      handlebars.default.registerPartial(
        parcial,
        this.readTemplate(join('partials', `${parcial}.hbs`)),
      );
    }

    const templateFile = this.readTemplate(templateName);
    const template = handlebars.default.compile(templateFile);
    return template({
      ...data,
      logoBase64: this.readLogoBase64('logo.png'),
      // Logo institucional de ACEAA, el que llevan los formularios oficiales
      logoAceaaBase64: this.readLogoBase64('logo-aceaa.jpg'),
    });
  }

  /** PDF de un documento armado con `documentoPdf`. */
  pdfDe(documento: DocumentoPdf): Promise<Buffer> {
    return this.generatePdf(
      documento.plantilla,
      documento.datos,
      documento.opciones,
    );
  }

  /** Vista en pantalla (misma plantilla que el PDF) de un documento. */
  htmlDe(documento: DocumentoPdf): Promise<string> {
    return this.renderHtml(documento.plantilla, documento.datos);
  }

  async generatePdf(
    templateName: string,
    data: any,
    options?: OpcionesPdf,
  ): Promise<Buffer> {
    // Dynamic import para evitar cargar puppeteer en startup
    const puppeteer = await import('puppeteer');

    const html = await this.renderHtml(templateName, data);

    let browser: Browser | null = null;

    try {
      // Configuración de Puppeteer con soporte para variables de entorno
      const launchOptions: LaunchOptions = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      };

      // Permitir ruta personalizada de Chrome/Chromium vía variable de entorno
      const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      if (executablePath) {
        launchOptions.executablePath = executablePath;
        this.logger.debug(
          `Usando ejecutable de Chrome personalizado: ${executablePath}`,
        );
      }

      browser = await puppeteer.launch(launchOptions);

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdf = await page.pdf({
        format: 'A4',
        landscape: options?.landscape ?? false,
        printBackground: true,
        margin: {
          top: `${options?.marginMm ?? MARGEN_MM}mm`,
          bottom: `${options?.marginMm ?? MARGEN_MM}mm`,
          left: `${options?.marginMm ?? MARGEN_MM}mm`,
          right: `${options?.marginMm ?? MARGEN_MM}mm`,
        },
      });

      return Buffer.from(pdf);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';
      const errorStack =
        error instanceof Error ? error.stack : 'Sin stack trace';

      // Detectar error específico de Chrome no encontrado
      if (errorMessage.includes('Could not find Chrome')) {
        this.logger.error(
          `Chrome/Chromium no encontrado. Ejecute: pnpm exec puppeteer browsers install chrome`,
          errorStack,
        );
        throw new InternalServerErrorException(
          'No se pudo generar el PDF: Chrome no está instalado. Contacte al administrador del sistema.',
        );
      }

      this.logger.error(
        `No se pudo generar el PDF con template ${templateName}: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException(
        'No se pudo generar el PDF. Intente nuevamente más tarde.',
      );
    } finally {
      if (browser) {
        await browser.close().catch((closeError) => {
          this.logger.warn(
            `Error al cerrar el navegador: ${closeError instanceof Error ? closeError.message : 'desconocido'}`,
          );
        });
      }
    }
  }

  private readTemplate(templateName: string): string {
    const templatePaths = [
      join(__dirname, '..', 'templates', templateName),
      join(process.cwd(), 'src', 'templates', templateName),
      join(process.cwd(), 'dist', 'templates', templateName),
    ];

    for (const templatePath of templatePaths) {
      if (fs.existsSync(templatePath)) {
        return fs.readFileSync(templatePath, 'utf8');
      }
    }

    throw new InternalServerErrorException(
      `Template PDF no encontrado: ${templateName}`,
    );
  }

  /**
   * Logos de ACEAA y de AMZ desk en binario, para los documentos que no pasan
   * por las plantillas (el Excel del ANEXO 4).
   */
  leerLogos(): LogosDocumento {
    const leer = (archivo: string) => {
      const base64 = this.readLogoBase64(archivo);
      return base64 ? Buffer.from(base64, 'base64') : null;
    };
    return { aceaa: leer('logo-aceaa.jpg'), amz: leer('logo.png') };
  }

  private readLogoBase64(fileName: string): string | null {
    const logoPath = join(process.cwd(), fileName);

    if (!fs.existsSync(logoPath)) {
      this.logger.warn(`Logo no encontrado en ruta: ${logoPath}`);
      return null;
    }

    const logoBuffer = fs.readFileSync(logoPath);
    return logoBuffer.toString('base64');
  }
}
