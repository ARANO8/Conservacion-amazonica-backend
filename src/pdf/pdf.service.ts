import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';
import puppeteer from 'puppeteer';

type PdfTemplateContext = Record<string, unknown>;

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  async generatePdf(
    templateName: string,
    context: PdfTemplateContext,
  ): Promise<Buffer> {
    const templateSource = await this.loadTemplate(templateName);
    const html = Handlebars.compile(templateSource)(context);

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
          top: '16mm',
          right: '12mm',
          bottom: '16mm',
          left: '12mm',
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

  private async loadTemplate(templateName: string): Promise<string> {
    const candidates = [
      path.join(process.cwd(), 'src', 'templates', templateName),
      path.join(process.cwd(), 'dist', 'src', 'templates', templateName),
      path.join(process.cwd(), 'dist', 'templates', templateName),
    ];

    for (const candidate of candidates) {
      try {
        await fs.access(candidate);
        return await fs.readFile(candidate, 'utf8');
      } catch {
        continue;
      }
    }

    throw new InternalServerErrorException(
      `Template PDF no encontrado: ${templateName}`,
    );
  }
}
