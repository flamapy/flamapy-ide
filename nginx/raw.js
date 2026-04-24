// njs (nginx JavaScript) handler for the /raw endpoint.
// Decodes a base64-encoded UVL model from the `model` query parameter and
// returns it as plain text so that UVLHub can fetch the raw UVL content.
//
// Encoding used by the IDE (btoa(unescape(encodeURIComponent(uvl)))) is
// equivalent to base64 of the UTF-8 byte sequence of the UVL string, which
// Buffer.from(model, 'base64').toString('utf-8') reverses correctly.

function handler(r) {
    const model = r.args['model'];

    if (!model) {
        r.return(400, 'Missing required query parameter: model\n');
        return;
    }

    try {
        const uvl = Buffer.from(model, 'base64').toString('utf-8');
        r.headersOut['Content-Type'] = 'text/plain; charset=utf-8';
        r.headersOut['Access-Control-Allow-Origin'] = '*';
        r.return(200, uvl);
    } catch (_) {
        r.return(400, 'Invalid base64 encoding\n');
    }
}

export default { handler };
