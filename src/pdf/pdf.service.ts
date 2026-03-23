import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as fs from 'fs';
import { join } from 'path';
import Handlebars from 'handlebars';
import puppeteer from 'puppeteer';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  async generatePdf(templateName: string, data: any): Promise<Buffer> {
    const templateFile = this.readTemplate(templateName);
    const template = Handlebars.compile(templateFile);
    const logoBase64 = this.readLogoBase64();
    const html = template({
      ...data,
      logoBase64,
    });

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdf = await page.pdf({
        format: 'A4',
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
      this.logger.error(
        `No se pudo generar el PDF con template ${templateName}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException('No se pudo generar el PDF');
    } finally {
      await browser.close();
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
