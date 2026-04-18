const Anthropic = require('@anthropic-ai/sdk');

const EXTRACTION_PROMPT = `Analyze this payment screenshot and extract the following information in JSON format only.
Return ONLY valid JSON, no other text.

For a Zelle payment screenshot, extract:
{
  "payment_type": "zelle",
  "sent_to": "name the money was sent to",
  "registered_as": "how the recipient is registered in Zelle",
  "from_account": "source account (e.g. CHECKING ...8150)",
  "confirmation_number": "Zelle confirmation code",
  "paid_at_datetime": "ISO 8601 datetime if visible",
  "bank": "bank name",
  "amount": 0.00
}

For a Wells Fargo cash eWithdrawal receipt, extract:
{
  "payment_type": "cash",
  "bank": "Wells Fargo Bank",
  "account": "account shown (e.g. CHK XXXXXX6285)",
  "branch_number": "branch number if visible",
  "transaction_number": "transaction number",
  "paid_at_datetime": "ISO 8601 datetime",
  "amount": 0.00
}

For a check, extract:
{
  "payment_type": "check",
  "payable_to": "name on check",
  "check_number": "check number",
  "bank": "bank name",
  "account": "account if visible",
  "paid_at_datetime": "ISO 8601 date",
  "amount": 0.00
}

If you cannot determine the payment type, return: { "payment_type": "unknown" }`;

async function extractPaymentData(base64Image, mediaType = 'image/jpeg') {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        messages: [
            {
                role: 'user',
                content: [
                    {
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: mediaType,
                            data: base64Image,
                        },
                    },
                    {
                        type: 'text',
                        text: EXTRACTION_PROMPT,
                    },
                ],
            },
        ],
    });

    const text = response.content[0]?.text || '';
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { payment_type: 'unknown' };
    } catch {
        return { payment_type: 'unknown' };
    }
}

module.exports = { extractPaymentData };
