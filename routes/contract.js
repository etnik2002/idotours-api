require('dotenv').config();
const express = require('express');
const router = express.Router();
const Contract = require('../models/Contract');
const nodemailer = require('nodemailer');
const puppeteer = require('puppeteer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS // This MUST be a Gmail App Password
  },
  tls: {
    rejectUnauthorized: false
  },
  pool: true,
  maxConnections: 5,
  maxMessages: 10,
  connectionTimeout: 60000,
  greetingTimeout: 30000,
  socketTimeout: 75000
});

transporter.verify((error, success) => {
  if (error) {
  } else {
  }
});



function generateContractHTML(data) {
  const currentDate = new Date().toLocaleDateString('sq-AL');
  
  return `
<!DOCTYPE html>
<html lang="sq">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Marrëveshje Gobusly - ${data.operatorName}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #f8f9fa;
        }
        .contract-container {
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #0066cc;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .logo {
            width: 150px;
            height: auto;
            margin-bottom: 20px;
        }
        .title {
            color: #0066cc;
            font-size: 28px;
            font-weight: bold;
            margin: 0;
        }
        .subtitle {
            color: #666;
            font-size: 16px;
            margin-top: 5px;
        }
        .parties-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin: 30px 0;
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
        }
        .party {
            padding: 15px;
        }
        .party-title {
            color: #0066cc;
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 15px;
            border-bottom: 2px solid #0066cc;
            padding-bottom: 5px;
        }
        .section {
            margin: 25px 0;
        }
        .section-title {
            color: #0066cc;
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 15px;
            border-left: 4px solid #0066cc;
            padding-left: 15px;
        }
        .commission-highlight {
            background: linear-gradient(135deg, #0066cc, #004499);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            margin: 20px 0;
        }
        .commission-rate {
            font-size: 32px;
            font-weight: bold;
        }
        ul {
            padding-left: 20px;
        }
        li {
            margin: 8px 0;
        }
        .signature-section {
            margin-top: 50px;
            border-top: 2px solid #0066cc;
            padding-top: 30px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 50px;
        }
        .signature-box {
            text-align: center;
            padding: 20px;
            border: 2px dashed #ccc;
            border-radius: 8px;
        }
        .signature-title {
            color: #0066cc;
            font-weight: bold;
            margin-bottom: 15px;
        }
        .highlight-box {
            background: #e7f3ff;
            border: 1px solid #0066cc;
            border-radius: 8px;
            padding: 15px;
            margin: 15px 0;
        }
        .date-badge {
            background: #0066cc;
            color: white;
            padding: 10px 20px;
            border-radius: 20px;
            display: inline-block;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="contract-container">
        <div class="header">
            <img src="https://ph-files.imgix.net/fd3cbc20-0872-4a89-9363-119924a9e60c.png?auto=format" alt="Gobusly Logo" class="logo">
            <h1 class="title">MARRËVESHJE BASHKËPUNIMI</h1>
            <p class="subtitle">Operatori i Autobusëve</p>
            <div class="date-badge">Data: ${currentDate}</div>
        </div>

        <div class="parties-section">
            <div class="party">
                <div class="party-title">PALA E PARË</div>
                <h3>Gobusly</h3>
                <p>Platforma Digjitale e Rezervimeve</p>
                <p><strong>Email:</strong> Gobuslyinternal@gmail.com</p>
                <p><strong>Web:</strong> www.gobusly.com</p>
            </div>
            <div class="party">
                <div class="party-title">PALA E DYTË</div>
                <h3>${data.operatorName}</h3>
                <p>Operator Transporti</p>
                <p><strong>Adresa:</strong> ${data.operatorAddress}</p>
                <p><strong>Kontakt:</strong> ${data.contactPerson}</p>
                <p><strong>Email:</strong> ${data.operatorEmail}</p>
                <p><strong>Telefon:</strong> ${data.operatorPhone}</p>
            </div>
        </div>

        <div class="commission-highlight">
            <h3>Struktura e Komisionit</h3>
            <div class="commission-rate">${data.commissionRate}%</div>
            <p>Komisioni i Gobusly nga shitjet e biletave</p>
            <p>Operatori merr ${100 - data.commissionRate}% të të ardhurave</p>
        </div>

        <div class="section">
            <h2 class="section-title">1. Hyrje dhe Objekti</h2>
            <p>Kjo Marrëveshje Bashkëpunimi rregullon marrëdhënien juridike dhe tregtare ndërmjet <strong>Gobusly</strong> (Kompania) si pronar dhe menaxhues i platformës së specializuar online për rezervimin e biletave të autobusëve, dhe <strong>${data.operatorName}</strong> (Operatori), për ofrimin e shërbimeve profesionale të transportit publik përmes ekosistemit digjital Gobusly.</p>
        </div>

        <div class="section">
            <h2 class="section-title">2. Pronësia dhe Arkitektura e Platformës</h2>
            <ul>
                <li>Kompania është pronari ekskluziv i platformës Gobusly, e cila funksionon si një ekosistem i integruar për rezervimin, menaxhimin dhe shpërndarjen e biletave të autobusëve.</li>
                <li>Operatorët do të kenë akses në panel kontrolli të dedikuar me funksionalitete të plota menaxhimi.</li>
                <li>Platforma ofron teknologji të krahasueshme me standardet ndërkombëtare të industrisë.</li>
            </ul>
        </div>

        <div class="section">
            <h2 class="section-title">3. Menaxhimi i Linjave dhe Shërbimeve</h2>
            <div class="highlight-box">
                <strong>AFATI KRITIK:</strong> Çdo ndryshim në linjat e transportit duhet të njoftohet Kompanisë së paku <strong>72 orë</strong> para hyrjes në fuqi.
            </div>
            <ul>
                <li>Operatorët janë plotësisht përgjegjës për ofrimin e informacionit të saktë për rutat, oraret, kapacitetet dhe çmimet.</li>
                <li>Kompania përditëson linjat në platformë bazuar në informacionin e dhënë.</li>
                <li>Mosrespektimi i afateve mund të rezultojë në pezullim të përkohshëm.</li>
            </ul>
        </div>

        <div class="section">
            <h2 class="section-title">4. Kapaciteti dhe Garantia e Shërbimit</h2>
            <div class="highlight-box">
                <strong>GARANTIA 100%:</strong> Çdo rezervim i kryer përmes Gobusly garanton një vend të rezervuar në autobus.
            </div>
            <ul>
                <li>Operatorët menaxhojnë kapacitetet në kohë reale përmes panelit të tyre.</li>
                <li>Sistemi parandalon automatikisht mbirezervimin.</li>
                <li>Operatorët duhet të përditësojnë kapacitetet në mënyrë të vazhdueshme.</li>
            </ul>
        </div>

        <div class="section">
            <h2 class="section-title">5. Komisioni dhe Pagesat</h2>
            <ul>
                <li>Kompania mban një komision prej <strong>${data.commissionRate}%</strong> nga shuma bruto e shitjeve.</li>
                <li>Pjesa prej <strong>${100 - data.commissionRate}%</strong> transferohet tek Operatori.</li>
                <li>Pagesat bëhen brenda 7 ditëve pune nga kërkesa.</li>
                <li>Çdo pagesë shoqërohet me raport të detajuar.</li>
            </ul>
        </div>

        <div class="section">
            <h2 class="section-title">6. Përgjegjësitë e Palëve</h2>
            <h3>Përgjegjësitë e Operatorit:</h3>
            <ul>
                <li>Garantim i saktësisë së informacionit për linjat dhe kapacitetet</li>
                <li>Respektim i afateve të njoftimit për ndryshimet</li>
                <li>Sigurimi i cilësisë dhe sigurisë së shërbimeve</li>
                <li>Menaxhimi profesional i ankesave të klientëve</li>
                <li>Përmbushja e detyrimeve ligjore dhe rregullatore</li>
            </ul>
            
            <h3>Përgjegjësitë e Gobusly:</h3>
            <ul>
                <li>Mirëmbajtja dhe zhvillimi i platformës</li>
                <li>Mbështetje teknike 24/7</li>
                <li>Promovim aktiv i shërbimeve të partnerëve</li>
                <li>Përpunim i saktë dhe në kohë i pagesave</li>
            </ul>
        </div>

        <div class="section">
            <h2 class="section-title">7. Kuadri Ligjor</h2>
            <ul>
                <li>Juridiksioni kryesor: Shteti i Delaware, SHBA</li>
                <li>Operatorët duhet të respektojnë ligjet lokale</li>
                <li>Çdo shkelje ligjore është përgjegjësi ekskluzive e Operatorit</li>
            </ul>
        </div>

        <div class="section">
            <h2 class="section-title">8. Kohëzgjatja dhe Përfundimi</h2>
            <ul>
                <li>Marrëveshja hyn në fuqi me nënshkrimin</li>
                <li>Njoftim paraprak: 30 ditë me shkrim për ndërprerje</li>
                <li>E drejta e ndërprerjes së menjëhershme për shkelje të rënda</li>
            </ul>
        </div>

        <div class="section">
            <h2 class="section-title">9. Konfidencialiteti</h2>
            <p>Të dy palët zotohen për mbrojtjen e informacionit proprietar dhe moskomunikimin e të dhënave tek palë të treta pa autorizim, duke respektuar standardet ndërkombëtare të sigurisë së të dhënave (GDPR, CCPA).</p>
        </div>

        <div class="signature-section">
            <div class="signature-box">
                <div class="signature-title">PËR GOBUSLY</div>
                <div style="height: 80px; margin: 20px 0; border-bottom: 1px solid #ccc;"></div>
                <p>Emri: _________________</p>
                <p>Titulli: _________________</p>
                <p>Data: ${currentDate}</p>
            </div>
            <div class="signature-box">
                <div class="signature-title">PËR ${data.operatorName.toUpperCase()}</div>
                <div style="height: 80px; margin: 20px 0; border-bottom: 1px solid #ccc;"></div>
                <p>Emri: _________________</p>
                <p>Titulli: _________________</p>
                <p>Data: ${currentDate}</p>
            </div>
        </div>

        <div style="text-align: center; margin-top: 30px; color: #666; font-size: 12px;">
            <p>Marrëveshje e Mbrojtur Ligjërisht • Gobusly © 2025 • Të Gjitha të Drejtat e Rezervuara</p>
        </div>
    </div>
</body>
</html>`;
}

// Create a new contract
router.post('/create', async (req, res) => {
  try {
    const {
      operatorName,
      operatorEmail,
      operatorAddress,
      contactPerson,
      operatorPhone,
      commissionRate
    } = req.body;

    // Validate required fields
    if (!operatorName || !operatorEmail || !operatorAddress || !contactPerson || !operatorPhone || !commissionRate) {
      return res.status(400).json({
        success: false,
        message: 'Të gjitha fushat janë të detyrueshme'
      });
    }

    // Generate contract HTML
    const contractHTML = generateContractHTML({
      operatorName,
      operatorEmail,
      operatorAddress,
      contactPerson,
      operatorPhone,
      commissionRate: parseFloat(commissionRate)
    });

    // Create contract in database
    const contract = new Contract({
      operatorName,
      operatorEmail,
      operatorAddress,
      contactPerson,
      operatorPhone,
      commissionRate: parseFloat(commissionRate),
      contractHTML,
      status: 'draft'
    });

    await contract.save();

    res.status(201).json({
      success: true,
      message: 'Kontrata u krijua me sukses',
      contract: {
        id: contract._id,
        contractId: contract.contractId,
        operatorName: contract.operatorName,
        status: contract.status,
        createdAt: contract.createdAt
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Gabim në krijimin e kontratës',
      error: error.message
    });
  }
});

router.get('/download/:contractId', async (req, res) => {
  try {
    const contract = await Contract.findOne({ contractId: req.params.contractId });
    
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Kontrata nuk u gjet'
      });
    }

    // Generate contract HTML with signature if signed
    let contractHTML = contract.contractHTML;
    if (contract.signed && contract.signatureData) {
      contractHTML = injectSignatureIntoContract(contractHTML, {
        signatureData: contract.signatureData,
        signerName: contract.signerName || contract.contactPerson,
        signerTitle: contract.signerTitle || 'Përfaqësues Ligjor',
        signedAt: contract.signedAt
      });
    }

    // Launch puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Set page format for PDF
    await page.setViewport({ width: 1200, height: 800 });
    
    // Load the contract HTML
    await page.setContent(contractHTML, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Generate PDF
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        bottom: '20mm',
        left: '15mm',
        right: '15mm'
      },
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-size: 10px; color: #666; text-align: center; width: 100%; padding: 10px;">
          <span>Gobusly Partnership Agreement - ${contract.operatorName}</span>
        </div>
      `,
      footerTemplate: `
        <div style="font-size: 10px; color: #666; text-align: center; width: 100%; padding: 10px;">
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span> | Generated on ${new Date().toLocaleDateString('sq-AL')}</span>
        </div>
      `
    });

    await browser.close();

    // Set response headers for PDF download
    const filename = `Contract_${contract.operatorName.replace(/[^a-zA-Z0-9]/g, '_')}_${contract.contractId}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdf.length);
    
    // Send the PDF
    res.send(pdf);

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Gabim në gjenerimin e PDF-së',
      error: error.message
    });
  }
});

// Get contract for printing (clean HTML without extra styling)
router.get('/print/:contractId', async (req, res) => {
  try {
    const contract = await Contract.findOne({ contractId: req.params.contractId });
    
    if (!contract) {
      return res.status(404).send('<h1>Kontrata nuk u gjet</h1>');
    }

    // Generate contract HTML with signature if signed
    let contractHTML = contract.contractHTML;
    if (contract.signed && contract.signatureData) {
      contractHTML = injectSignatureIntoContract(contractHTML, {
        signatureData: contract.signatureData,
        signerName: contract.signerName || contract.contactPerson,
        signerTitle: contract.signerTitle || 'Përfaqësues Ligjor',
        signedAt: contract.signedAt
      });
    }

    // Generate print-optimized HTML
    const printHTML = `
<!DOCTYPE html>
<html lang="sq">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Print - Contract ${contract.operatorName}</title>
    <style>
        @media print {
            * {
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
            }
            
            body {
                margin: 0;
                padding: 20px;
                font-size: 12px;
                line-height: 1.4;
            }
            
            @page {
                margin: 20mm;
                size: A4;
                
                @top-center {
                    content: "Gobusly Partnership Agreement - ${contract.operatorName}";
                    font-size: 10px;
                    color: #666;
                }
                
                @bottom-center {
                    content: "Page " counter(page) " of " counter(pages);
                    font-size: 10px;
                    color: #666;
                }
            }
            
            .page-break {
                page-break-before: always;
            }
            
            .no-print {
                display: none !important;
            }
        }
        
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 100%;
            margin: 0 auto;
            padding: 20px;
        }
        
        h1, h2, h3 {
            color: #0066cc;
            margin-top: 2em;
            margin-bottom: 1em;
        }
        
        .signature-section {
            margin-top: 3em;
            border-top: 2px solid #0066cc;
            padding-top: 2em;
        }
        
        .signed-signature img {
            max-width: 200px;
            max-height: 80px;
            border: 1px solid #ccc;
            padding: 5px;
        }
        
        .contract-info {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        
        th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
        
        th {
            background-color: #f2f2f2;
        }
        
        .print-header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #0066cc;
        }
        
        .print-footer {
            margin-top: 50px;
            text-align: center;
            font-size: 10px;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 20px;
        }
    </style>
    <script>
        window.onload = function() {
            setTimeout(function() {
                window.print();
            }, 500);
        };
    </script>
</head>
<body>
    <div class="print-header">
        <h1>Gobusly Partnership Agreement</h1>
        <p><strong>${contract.operatorName}</strong></p>
        <p>Contract ID: ${contract.contractId}</p>
        <p>Generated: ${new Date().toLocaleString('sq-AL')}</p>
    </div>
    
    ${contractHTML}
    
    <div class="print-footer">
        <p>This is an official Gobusly partnership agreement.</p>
        <p>© ${new Date().getFullYear()} Gobusly. All rights reserved.</p>
    </div>
</body>
</html>`;

    res.send(printHTML);

  } catch (error) {
    res.status(500).send(`<h1>Error</h1><p>Gabim në gjenerimin e faqes për printim: ${error.message}</p>`);
  }
});

// Get contract statistics for download/print tracking
router.post('/track-action/:contractId', async (req, res) => {
  try {
    const { action } = req.body; // 'download' or 'print'
    const contract = await Contract.findOne({ contractId: req.params.contractId });
    
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Kontrata nuk u gjet'
      });
    }

    res.json({
      success: true,
      message: 'Action tracked successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Gabim në regjistrimin e veprimit'
    });
  }
});


router.get('/preview/:contractId', async (req, res) => {
  try {
    const contract = await Contract.findOne({ contractId: req.params.contractId });
    
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Kontrata nuk u gjet'
      });
    }

    let contractHTML = contract.contractHTML;

    if (contract.signed && contract.signatureData) {
      contractHTML = injectSignatureIntoContract(contractHTML, {
        signatureData: contract.signatureData,
        signerName: contract.signerName || contract.contactPerson,
        signerTitle: contract.signerTitle || 'Përfaqësues Ligjor',
        signedAt: contract.signedAt
      }, contract);
    }

    res.send(contractHTML);

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Gabim në shfaqjen e kontratës'
    });
  }
});

function injectSignatureIntoContract(contractHTML, signatureInfo, contract) {
  const signatureSection = `
    <div style="margin-top: 50px; border-top: 3px solid #0066cc; padding-top: 30px;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 50px;">
        <div style="text-align: center; padding: 20px; border: 2px solid #28a745; border-radius: 8px; background: #f8fff8;">
          <div style="color: #0066cc; font-weight: bold; margin-bottom: 15px; font-size: 18px;">PËR GOBUSLY</div>
          <div style="height: 80px; margin: 20px 0; border-bottom: 1px solid #ccc;"></div>
          <p><strong>Emri:</strong> _________________</p>
          <p><strong>Titulli:</strong> _________________</p>
          <p><strong>Data:</strong> ${new Date().toLocaleDateString('sq-AL')}</p>
          <div style="color: #6c757d; font-size: 12px; margin-top: 10px;">
            <em>Për tu nënshkruar nga Gobusly</em>
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px; border: 2px solid #28a745; border-radius: 8px; background: #f8fff8;">
          <div style="color: #0066cc; font-weight: bold; margin-bottom: 15px; font-size: 18px;">PËR ${signatureInfo.signerName.toUpperCase()}</div>
          
          <div style="margin: 20px 0; padding: 10px; background: white; border: 1px solid #28a745; border-radius: 4px;">
            <img src="${signatureInfo.signatureData}" 
                 alt="Nënshkrimi Elektronik" 
                 style="max-width: 200px; max-height: 60px; object-fit: contain;">
          </div>
          
          <p><strong>Emri:</strong> ${signatureInfo.signerName}</p>
          <p><strong>Titulli:</strong> ${signatureInfo.signerTitle}</p>
          <p><strong>Data:</strong> ${new Date(signatureInfo.signedAt).toLocaleDateString('sq-AL')}</p>
          
          <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 15px; color: #28a745; font-weight: bold;">
            <span style="font-size: 16px;">✅</span>
            <span>NËNSHKRUAR ELEKTRONIKISHT</span>
          </div>
          
          <div style="color: #6c757d; font-size: 11px; margin-top: 10px;">
            <div>IP: ${contract?.signerIP || 'N/A'}</div>
            <div>Koha: ${new Date(signatureInfo.signedAt).toLocaleString('sq-AL')}</div>
          </div>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 30px; padding: 20px; background: #e8f5e8; border: 1px solid #28a745; border-radius: 8px;">
        <div style="color: #28a745; font-weight: bold; font-size: 16px; margin-bottom: 5px;">
          🔒 KONTRATË E NËNSHKRUAR DHE E VËRTETUAR
        </div>
        <div style="color: #155724; font-size: 14px;">
          Kjo kontratë është nënshkruar elektronikisht dhe ka fuqi të plotë ligjore.
        </div>
      </div>
    </div>
  `;

  if (contractHTML.includes('class="signature-section"') || contractHTML.includes('PËR GOBUSLY')) {
    contractHTML = contractHTML.replace(
      /<div[^>]*class[^>]*signature[^>]*>[\s\S]*?<\/div>/gi,
      signatureSection
    );
  } else {
    contractHTML = contractHTML.replace(
      '</body>',
      signatureSection + '</body>'
    );
  }

  return contractHTML;
}


router.post('/send/:contractId', async (req, res) => {
  try {
    const contract = await Contract.findOne({ contractId: req.params.contractId });
    
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Kontrata nuk u gjet'
      });
    }

    const signingUrl = `${process.env.CONTRACT_FRONTEND_BASE_URL || 'https://ceo.gobusly.com'}/contract/sign/${contract.signingToken}`;
    
    const emailHTML = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0066cc; color: white; padding: 20px; text-align: center;">
          <img src="https://ph-files.imgix.net/fd3cbc20-0872-4a89-9363-119924a9e60c.png?auto=format" alt="Gobusly" style="width: 120px; height: auto;">
          <h2>Marrëveshja e Bashkëpunimit</h2>
        </div>
        
        <div style="padding: 30px; background: #f9f9f9;">
          <h3>Përshëndetje ${contract.contactPerson},</h3>
          
          <p>Ju dërgojmë marrëveshjen e bashkëpunimit ndërmjet Gobusly dhe ${contract.operatorName}.</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h4>Detajet e Marrëveshjes:</h4>
            <ul>
              <li><strong>Operatori:</strong> ${contract.operatorName}</li>
              <li><strong>Komisioni:</strong> ${contract.commissionRate}%</li>
              <li><strong>Data e Krijimit:</strong> ${new Date(contract.createdAt).toLocaleDateString('sq-AL')}</li>
            </ul>
          </div>
          
          <p>Për të nënshkruar kontratën, ju lutemi klikoni butonin më poshtë:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${signingUrl}" style="background: #0066cc; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Nënshkruaj Kontratën
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            Nëse keni pyetje, ju lutemi na kontaktoni në Gobuslyinternal@gmail.com
          </p>
        </div>
        
        <div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
          <p>&copy; 2025 Gobusly. Të gjitha të drejtat e rezervuara.</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: contract.operatorEmail,
      cc: 'Gobuslyinternal@gmail.com',
      subject: `Marrëveshja e Bashkëpunimit - ${contract.operatorName}`,
      html: emailHTML
    });

    contract.status = 'sent';
    contract.emailSent = true;
    contract.emailSentAt = new Date();
    await contract.save();

    res.json({
      success: true,
      message: 'Kontrata u dërgua me sukses',
      signingUrl
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Gabim në dërgimin e kontratës',
      error: error.message
    });
  }
});


router.get('/sign/:signingToken', async (req, res) => {
  try {
    const contract = await Contract.findOne({ signingToken: req.params.signingToken });
    
    if (!contract) {
      return res.status(404).send('Kontrata nuk u gjet ose linku ka skaduar.');
    }

    if (contract.signed) {
      return res.send(`
        <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
          <h2 style="color: #0066cc;">Kontrata është nënshkruar tashmë</h2>
          <p>Kjo kontratë është nënshkruar në ${new Date(contract.signedAt).toLocaleDateString('sq-AL')}</p>
        </div>
      `);
    }

    const signingPageHTML = `
<!DOCTYPE html>
<html lang="sq">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nënshkruaj Kontratën - ${contract.operatorName}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1000px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .header {
            background: #0066cc;
            color: white;
            padding: 20px;
            text-align: center;
        }
        .content {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 0;
        }
        .contract-view {
            padding: 20px;
            max-height: 80vh;
            overflow-y: auto;
            border-right: 1px solid #eee;
        }
        .signing-panel {
            padding: 30px;
            background: #f9f9f9;
        }
        .signature-pad {
            border: 2px dashed #ccc;
            width: 100%;
            height: 200px;
            margin: 15px 0;
            cursor: crosshair;
            background: white;
            border-radius: 4px;
        }
        .btn {
            background: #0066cc;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            margin: 5px;
        }
        .btn:hover {
            background: #0052a3;
        }
        .btn-secondary {
            background: #6c757d;
        }
        .btn-secondary:hover {
            background: #545b62;
        }
        .form-group {
            margin: 15px 0;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        input {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
        }
        .success-message {
            background: #d4edda;
            color: #155724;
            padding: 15px;
            border-radius: 4px;
            margin: 15px 0;
            border: 1px solid #c3e6cb;
        }
        .error-message {
            background: #f8d7da;
            color: #721c24;
            padding: 15px;
            border-radius: 4px;
            margin: 15px 0;
            border: 1px solid #f5c6cb;
        }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/signature_pad@4.0.0/dist/signature_pad.umd.min.js"></script>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="https://ph-files.imgix.net/fd3cbc20-0872-4a89-9363-119924a9e60c.png?auto=format" alt="Gobusly" style="width: 100px; height: auto; margin-bottom: 10px;">
            <h2>Nënshkrim Elektronik i Kontratës</h2>
            <p>${contract.operatorName}</p>
        </div>
        
        <div class="content">
            <div class="contract-view">
                ${contract.contractHTML}
            </div>
            
            <div class="signing-panel">
                <h3>Nënshkruaj Kontratën</h3>
                
                <div class="form-group">
                    <label for="signerName">Emri dhe Mbiemri:</label>
                    <input type="text" id="signerName" value="${contract.contactPerson}" required>
                </div>
                
                <div class="form-group">
                    <label for="signerTitle">Pozicioni/Titulli:</label>
                    <input type="text" id="signerTitle" placeholder="Menaxher, Drejtor, etj." required>
                </div>
                
                <div class="form-group">
                    <label>Nënshkrimi Digjital:</label>
                    <canvas id="signature-pad" class="signature-pad"></canvas>
                    <div>
                        <button type="button" class="btn btn-secondary" onclick="clearSignature()">Pastro</button>
                    </div>
                </div>
                
                <div id="message"></div>
                
                <button type="button" class="btn" onclick="submitSignature()" id="signBtn">
                    Nënshkruaj Kontratën
                </button>
                
                <p style="font-size: 12px; color: #666; margin-top: 20px;">
                    Duke nënshkruar, ju konfirmoni që keni lexuar dhe pranoni kushtet e kësaj marrëveshjeje.
                </p>
            </div>
        </div>
    </div>

    <script>
        const canvas = document.getElementById('signature-pad');
        const signaturePad = new SignaturePad(canvas, {
            backgroundColor: 'rgb(255, 255, 255)',
            penColor: 'rgb(0, 0, 0)'
        });

        function resizeCanvas() {
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio;
            canvas.height = canvas.offsetHeight * ratio;
            canvas.getContext("2d").scale(ratio, ratio);
            signaturePad.clear();
        }

        window.addEventListener("resize", resizeCanvas);
        resizeCanvas();

        function clearSignature() {
            signaturePad.clear();
        }

        async function submitSignature() {
            const signerName = document.getElementById('signerName').value;
            const signerTitle = document.getElementById('signerTitle').value;
            const messageDiv = document.getElementById('message');
            const signBtn = document.getElementById('signBtn');

            if (!signerName.trim()) {
                messageDiv.innerHTML = '<div class="error-message">Ju lutemi shkruani emrin dhe mbiemrin.</div>';
                return;
            }

            if (!signerTitle.trim()) {
                messageDiv.innerHTML = '<div class="error-message">Ju lutemi shkruani pozicionin/titullin.</div>';
                return;
            }

            if (signaturePad.isEmpty()) {
                messageDiv.innerHTML = '<div class="error-message">Ju lutemi nënshkruani në fushën e nënshkrimit.</div>';
                return;
            }

            signBtn.disabled = true;
            signBtn.textContent = 'Duke nënshkruar...';

            try {
                const signatureData = signaturePad.toDataURL();
                
                const response = await fetch('/contract/submit-signature/${contract.signingToken}', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        signerName,
                        signerTitle,
                        signatureData
                    })
                });

                const result = await response.json();

                if (result.success) {
                    messageDiv.innerHTML = '<div class="success-message">Kontrata u nënshkrua me sukses! Ju faleminderit për bashkëpunimin.</div>';
                    signBtn.style.display = 'none';
                    
                    // Redirect after 3 seconds
                    setTimeout(() => {
                        window.location.href = 'https://gobusly.com';
                    }, 3000);
                } else {
                    messageDiv.innerHTML = '<div class="error-message">' + result.message + '</div>';
                    signBtn.disabled = false;
                    signBtn.textContent = 'Nënshkruaj Kontratën';
                }
            } catch (error) {
                messageDiv.innerHTML = '<div class="error-message">Gabim në nënshkrim. Ju lutemi provoni përsëri.</div>';
                signBtn.disabled = false;
                signBtn.textContent = 'Nënshkruaj Kontratën';
            }
        }
    </script>
</body>
</html>`;

    res.send(signingPageHTML);

  } catch (error) {
    res.status(500).send('Gabim në ngarkimin e faqes së nënshkrimit.');
  }
});

router.post('/submit-signature/:signingToken', async (req, res) => {
  try {
    const { signerName, signerTitle, signatureData } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;

    const contract = await Contract.findOne({ signingToken: req.params.signingToken });
    
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Kontrata nuk u gjet'
      });
    }

    if (contract.signed) {
      return res.status(400).json({
        success: false,
        message: 'Kjo kontratë është nënshkruar tashmë'
      });
    }

    contract.signed = true;
    contract.signatureData = signatureData;
    contract.signerIP = clientIP;
    contract.signedAt = new Date();
    contract.status = 'signed';
    
    contract.signerName = signerName;
    contract.signerTitle = signerTitle;

    await contract.save();

    const confirmationEmail = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #28a745; color: white; padding: 20px; text-align: center;">
          <h2>Kontrata u Nënshkrua me Sukses</h2>
        </div>
        <div style="padding: 30px;">
          <h3>Marrëveshja u finalizua</h3>
          <p>Marrëveshja e bashkëpunimit ndërmjet Gobusly dhe ${contract.operatorName} u nënshkrua me sukses.</p>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h4>Detajet:</h4>
            <ul>
              <li><strong>Operatori:</strong> ${contract.operatorName}</li>
              <li><strong>Nënshkruesi:</strong> ${signerName}</li>
              <li><strong>Pozicioni:</strong> ${signerTitle}</li>
              <li><strong>Data e Nënshkrimit:</strong> ${new Date().toLocaleDateString('sq-AL')}</li>
              <li><strong>IP Adresa:</strong> ${clientIP}</li>
            </ul>
          </div>
          <p>Kopja e kontratës së nënshkruar do t'ju dërgohet së shpejti.</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: [contract.operatorEmail, 'Gobuslyinternal@gmail.com'],
      subject: `Kontrata u Nënshkrua - ${contract.operatorName}`,
      html: confirmationEmail
    });

    res.json({
      success: true,
      message: 'Kontrata u nënshkrua me sukses'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Gabim në nënshkrim',
      error: error.message
    });
  }
});

router.get('/list', async (req, res) => {
  try {
    const contracts = await Contract.find()
      .select('-contractHTML -signatureData')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      contracts
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Gabim në marrjen e kontratave'
    });
  }
});

router.get('/:contractId', async (req, res) => {
  try {
    const contract = await Contract.findOne({ 
      $or: [
        { contractId: req.params.contractId },
        { signingToken: req.params.contractId }
      ]
    });
    
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Kontrata nuk u gjet'
      });
    }

    const contractData = {
      ...contract.toObject(),
      signatureData: contract.signed ? contract.signatureData : null,
      signerName: contract.signed ? contract.signerName : null,
      signerTitle: contract.signed ? contract.signerTitle : null
    };

    res.json({
      success: true,
      contract: contractData
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Gabim në marrjen e kontratës'
    });
  }
});




router.post('/test-email', async (req, res) => {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.SMTP_USER,
      subject: 'Test Email from Gobusly',
      text: 'This is a test email to verify SMTP configuration.'
    });

    res.json({ success: true, message: 'Test email sent successfully' });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Test email failed',
      error: error.message,
      code: error.code
    });
  }
});


module.exports = router;
