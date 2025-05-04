const {join} = require("node:path");
const handlebars = require("handlebars");
const puppeteer = require('puppeteer');
const {randomUUID} = require("crypto");

class DocService{


    /**
     *
     * @param name - Name of PDF template
     * @param data - Data to be filled into template
     * @returns {{document_id: UUID, pdfBuffer: Promise<Uint8Array>}} - Document ID and PDF Buffer
     */
    getDocument(name, data={}){

        const {document_id, html} = this._renderDocTemplate(name, data);

        const { user_id } = data;



        const pdfBuffer = this._generatePDFFromHTML(html);

        return {
            document_id: document_id,
            pdfBuffer
        }
    }

    /**
     * Generate PDF Buffer from html code
     * @param html - code to be parsed to PDF
     * @returns {Promise<Uint8Array>} - PDF Buffer generated from html
     * @private
     */
    async _generatePDFFromHTML(html){
        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        await page.setContent(html, {
            waitUntil: 'networkidle0' // Wait until page is fully loaded
        })

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20mm',
                right: '20mm',
                bottom: '20mm',
                left: '20mm',
            }
        });

        await browser.close();
        return pdfBuffer;
    }

    /**
     * Get PDF template with data filled in
     * @param name - Name of template
     * @param data - Data to be filled in
     * @returns {{document_id: UUID, html: string}} - ID of document created and html from template
     * @private
     */
    _renderDocTemplate(name, data={}){

        // Generate doc metadata
        const currentDate = new Date.now();
        const docId = randomUUID();

        // Load template
        const templateSource = this._loadDocTemplate(name);

        // Set doc metadata
        data.current_date = currentDate;
        data.document_id = docId;

        // Fill in vars in html
        const html = templateSource(data);

        // Fill in ref qr-code for ref-cod sheets
        if(name === 'ref-code'){
            // TODO
        }

        return {
            document_id: docId,
            html
        };
    }

    /**
     * Get PDF template by name
     * @param name - Name of tempéate
     * @returns {HandlebarsTemplateDelegate<any>} - Compiled template
     * @private
     */
    _loadDocTemplate(name){
        const templatePath = join('./src/templates/docs/', `${name}.html`);
        const templateSource = fs.readFileSync(templatePath, 'utf-8');
        return handlebars.compile(templateSource);
    }
}

module.exports = new DocService();