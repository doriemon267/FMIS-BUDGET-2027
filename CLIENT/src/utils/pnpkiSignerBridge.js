import forge from 'node-forge';
import Swal from 'sweetalert2';

const MOCK_CERT_PEM = `-----BEGIN CERTIFICATE-----
MIIDdzCCAl+gAwIBAgIUQnB2YdN8R3HhQ4X0u5Tq2kqQ8L8wDQYJKoZIhvcNAQEL
BQAwVTELMAkGA1UEBhMCUEgxFjAUBgNVBAoMDUZNSVMgRGV2IFNpZ25lcjELMAkG
A1UECwwCRFYxITAfBgNVBAMMGEZNSVMgTW9jayBQTlBLSSBTaWduZXIwHhcNMjYw
MzA0MDAwMDAwWhcNMzYwMzAxMDAwMDAwWjBVMQswCQYDVQQGEwJQSDEWMBQGA1UE
CgwNRk1JUyBEZXYgU2lnbmVyMQswCQYDVQQLDAJEVjEhMB8GA1UEAwwYRk1JUyBN
b2NrIFBOUEtJIFNpZ25lcjCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEB
ALa4K5e2U8S8psjvWm1g7kJ2dQYv8KQ4hY6DkXJ9rXfB3vK4k2v8S0H8p2xWl6f6
tL6WJ6fQK+Y4vW2U0vFJvA7s4Vtq1oVv4s5x8F9WmQ2U6Vb4aN7aKkJmEwQX5Cq2
o0cD3kK5Czq7bJw3Q3N0VQ8Vxg7Qn5G9z7kqQmL5zC2YxN0u2QwHq2uR0m5YH5S2
gQ8b9m9v4Y8M1j4s2d4D3YQx3Y0xwY+T2E8lQY6DgVnIY8pV5X2UQ7W9H7Q6t2kD
7oVn6s2eY9zR8wQJxU6vY3m7f1tS6N3W0F8s7X3M2Q3Y8V1w2N8f6l7Q9m8hY0uR
2v8lqVd8a6z+7mJrQHfG7oECAwEAAaNTMFEwHQYDVR0OBBYEFG8h7M7S1gS6sP3m
0xT8z2R7jE5DMB8GA1UdIwQYMBaAFG8h7M7S1gS6sP3m0xT8z2R7jE5DMA8GA1Ud
EwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAJtq6fG0m4Qh6t0iX8YxQw8S
F4e4N2sJvYxWc5Hk0B1P0Yf2yQ2x2sS6tY3mJv7H4w4g8Jj0mL2a4k9k7fYvQ0kI
8Q3M4mG1r0zG7n5mQ6h2hKxM2rL4d0q2x2W5Q3j6Q8f7s1n2p5w4v8m2n6d8s0f4
g7k9m2q4x8n3r5t7v1w3y5z7c9d1f3g5h7j9k1l3m5n7p9r1t3v5x7z9b1d3f5h7
j9l1n3p5r7t9v1x3z5b7d9f1h3j5l7n9p1r3t5v7x9z1b3d5f7h9j1l3n5p7r9t1
v3x5z7b9d1f3h5j7l9n1p3r5t7v9x1z3b5d7f9h=
-----END CERTIFICATE-----`;

const toBase64 = (value) => {
  if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
    let binary = '';
    const bytes = new Uint8Array(value);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  const utf8 = new TextEncoder().encode(String(value || ''));
  let binary = '';
  utf8.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const createP12Signer = () => ({
  async signWorkflowPayload(payload, meta = {}) {
    console.log('[PNPKI] signWorkflowPayload called');
    
    let file = meta.p12File;
    let password = meta.p12Password;

    if (!file || !password) {
      const { value: formValues } = await Swal.fire({
        title: 'Digital Signature (P12 Mode)',
        html:
          '<div style="text-align: left; margin-bottom: 10px; color: #000;">Select your .p12 or .pfx certificate file:</div>' +
          '<input type="file" id="p12-file" class="swal2-file" accept=".p12,.pfx" style="display: block; width: 100%; margin-bottom: 15px;">' +
          '<div style="text-align: left; margin-bottom: 5px; color: #000;">Enter certificate password:</div>' +
          '<input type="password" id="p12-password" class="swal2-input" placeholder="Password" style="display: block; width: 100%; margin-top: 0;" autocomplete="off">',
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Sign Payload',
        allowOutsideClick: false,
        didOpen: () => {
          const container = Swal.getContainer();
          if (container) {
            container.style.zIndex = '999999';
          }
          
          const passwordInput = document.getElementById('p12-password');
          if (passwordInput) {
            // Force focus and stop ALL event propagation that MUI might be listening to
            const preventMuiInterference = (e) => {
              e.stopPropagation();
            };
            
            passwordInput.addEventListener('keydown', preventMuiInterference, true);
            passwordInput.addEventListener('keyup', preventMuiInterference, true);
            passwordInput.addEventListener('keypress', preventMuiInterference, true);
            passwordInput.addEventListener('mousedown', preventMuiInterference, true);
            passwordInput.addEventListener('click', (e) => {
              e.stopPropagation();
              passwordInput.focus();
            }, true);

            setTimeout(() => {
              passwordInput.focus();
              passwordInput.click();
            }, 500);
          }
        },
        preConfirm: () => {
          const f = document.getElementById('p12-file').files[0];
          const p = document.getElementById('p12-password').value;
          if (!f || !p) {
            Swal.showValidationMessage('Please select a file and enter password');
            return false;
          }
          return { file: f, password: p };
        }
      });

      if (!formValues) throw new Error('Signing cancelled by user');
      file = formValues.file;
      password = formValues.password;
    }

    const arrayBuffer = await file.arrayBuffer();
    const p12Der = forge.util.createBuffer(new Uint8Array(arrayBuffer));
    
    console.log('[PNPKI] forge object:', forge);
    if (forge.pkcs12) {
      console.log('[PNPKI] forge.pkcs12 keys:', Object.keys(forge.pkcs12));
    } else {
      console.warn('[PNPKI] forge.pkcs12 is UNDEFINED');
    }

    try {
      const p12Asn1 = forge.asn1.fromDer(p12Der.getBytes());
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);

      // Find the primary signing key and certificate
      const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const certBag = bags[forge.pki.oids.certBag][0];
      const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
      const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0];

      if (!certBag || !keyBag) {
        throw new Error('Could not find certificate or private key in P12 file');
      }

      const privateKey = keyBag.key;
      const certificate = certBag.cert;

      // Create signature
      const md = forge.md.sha256.create();
      md.update(payload, 'utf8');
      const signatureBytes = privateKey.sign(md);

      // Get certificate chain if available
      const chain = bags[forge.pki.oids.certBag].map(bag => forge.pki.certificateToPem(bag.cert));

      return {
        signature: forge.util.encode64(signatureBytes),
        certificatePem: forge.pki.certificateToPem(certificate),
        certificateChainPem: chain,
        algorithm: 'RSA-SHA256'
      };
    } catch (err) {
      console.error('[PNPKI] P12 parsing failed details:', err);
      const errorMsg = err?.message || String(err);
      throw new Error(`Failed to parse P12 file: ${errorMsg}. Please check your password or file format.`);
    }
  }
});

const createMockSigner = () => ({
  async signWorkflowPayload(payload, meta = {}) {
    const signatureSource = `${payload}::${meta?.signedAt || ''}::${meta?.action || ''}`;
    return {
      signature: toBase64(signatureSource),
      certificatePem: MOCK_CERT_PEM,
      certificateChainPem: [],
      algorithm: 'RSA-SHA256'
    };
  }
});

const createHttpBridgeSigner = () => {
  const baseUrl = import.meta.env.VITE_PNPKI_SIGNER_BRIDGE_URL || 'http://127.0.0.1:17890';
  return {
    async signWorkflowPayload(payload, meta = {}) {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/sign-workflow-payload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload, meta })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`PNPKI bridge failed (${response.status}): ${text || 'Unknown error'}`);
      }

      return response.json();
    }
  };
};

export const installPnpkiSignerBridge = () => {
  if (typeof window === 'undefined') return;

  const mode = String(import.meta.env.VITE_PNPKI_SIGNER_MODE || '').toLowerCase();
  const isProd = !!import.meta.env.PROD;
  if (!mode) return;

  if (window.PNPKISigner && typeof window.PNPKISigner.signWorkflowPayload === 'function') {
    return;
  }

  if (mode === 'mock') {
    if (isProd) {
      console.error('[PNPKI] Mock signer bridge is disabled in production. Use real PNPKI signer integration.');
      return;
    }
    window.PNPKISigner = createMockSigner();
    console.warn('[PNPKI] Mock signer bridge is active. Use for development only.');
    return;
  }

  if (mode === 'http') {
    window.PNPKISigner = createHttpBridgeSigner();
    console.info('[PNPKI] HTTP signer bridge is active.');
    return;
  }

  if (mode === 'p12') {
    window.PNPKISigner = createP12Signer();
    console.info('[PNPKI] P12 signer bridge is active.');
  }
};
