import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as fs from 'fs';
import { join } from 'path';
import type { Browser, LaunchOptions } from 'puppeteer';

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

    const templateFile = this.readTemplate(templateName);
    const template = handlebars.default.compile(templateFile);
    return template({
      ...data,
      logoBase64: this.readLogoBase64('logo.png'),
      // Logo institucional de ACEAA, el que llevan los formularios oficiales
      logoAceaaBase64: this.readLogoBase64('logo-aceaa.jpg'),
    });
  }

  async generatePdf(
    templateName: string,
    data: any,
    options?: { landscape?: boolean; marginMm?: number },
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
          top: `${options?.marginMm ?? 20}mm`,
          bottom: `${options?.marginMm ?? 20}mm`,
          left: `${options?.marginMm ?? 20}mm`,
          right: `${options?.marginMm ?? 20}mm`,
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
