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

  async generatePdf(
    templateName: string,
    data: any,
    options?: { landscape?: boolean },
  ): Promise<Buffer> {
    // Dynamic imports para evitar cargar puppeteer y handlebars en startup
    const Handlebars = await import('handlebars');
    const puppeteer = await import('puppeteer');

    const templateFile = this.readTemplate(templateName);
    const template = Handlebars.compile(templateFile);
    const logoBase64 = this.readLogoBase64();
    const html = template({
      ...data,
      logoBase64,
    });

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
          top: '20mm',
          bottom: '20mm',
          left: '20mm',
          right: '20mm',
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

  private readLogoBase64(): string | null {
    const logoPath = join(process.cwd(), 'logo.png');

    if (!fs.existsSync(logoPath)) {
      this.logger.warn(`Logo no encontrado en ruta: ${logoPath}`);
      return null;
    }

    const logoBuffer = fs.readFileSync(logoPath);
    return logoBuffer.toString('base64');
  }
}
