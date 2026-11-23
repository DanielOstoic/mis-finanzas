
const sleep = (ms: number) =>
    new Promise(resolve => setTimeout(resolve, ms));

export async function POST(request: Request) {
    let jsonData;

    try {
        jsonData = await request.json();
    } catch {
        return Response.json(
            { message: "Invalid JSON" },
            { status: 400 }
        );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return Response.json(
            { message: "Server configuration error" },
            { status: 500 }
        );
    }

    if (
        !jsonData ||
        typeof jsonData !== "object" ||
        Array.isArray(jsonData) ||
        !("text" in jsonData) ||
        typeof jsonData.text !== "string" ||
        jsonData.text.trim() === ""
    ) {
        return Response.json(
            { message: "Invalid text" },
            { status: 400 }
        );
    }

    if (jsonData.text.length > 20000) {
        return Response.json(
            { message: "Text limit exceeded" },
            { status: 413 }
        );
    }

    const schema = {
        type: "object",
        properties: {
            items: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        description: {
                            type: "string"
                        },
                        amount: {
                            type: "number"
                        }
                    },
                    required: ["description", "amount"]
                }
            }
        },
        required: ["items"]
    };

    const prompt = `
        Extract individual purchased products from this receipt.

        Rules:
        - Return only actual purchased products.
        - Do not include subtotals, totals or discounts.
        - Do not invent products or prices.
        - Use the total price for each product line.
        - Exclude ambiguous products when their price cannot be identified.
        - Return amounts as numbers.

        Receipt text:
        ${jsonData.text}
    `;

    const url =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent";

    const maxRetries = 3;

    try {
        let resultado: Response | undefined;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            resultado = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": apiKey
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                { text: prompt }
                            ]
                        }
                    ],
                    generationConfig: {
                        responseMimeType: "application/json",
                        responseJsonSchema: schema
                    }
                })
            });

            if (resultado.ok) {
                break;
            }

            const errorDetails = await resultado.text();

            const retryableStatuses = [
                429, 500, 502, 503, 504
            ];

            if (
                !retryableStatuses.includes(resultado.status) ||
                attempt === maxRetries
            ) {
                console.error(
                    "Gemini API error:",
                    resultado.status,
                    errorDetails
                );

                return Response.json(
                    { message: "Error consulting Gemini API" },
                    { status: 502 }
                );
            }

            const delay = Math.pow(2, attempt) * 1000;

            console.warn(
                `Gemini error ${resultado.status}. Retry ${attempt + 1}/${maxRetries} in ${delay}ms`
            );

            await sleep(delay);
        }

        if (!resultado?.ok) {
            return Response.json(
                { message: "Gemini API unavailable" },
                { status: 502 }
            );
        }

        const geminiData = await resultado.json();

        const generatedText =
            geminiData.candidates?.[0]?.content?.parts?.find(
                (part: { text?: string }) =>
                    typeof part.text === "string"
            )?.text;

        if (!generatedText) {
            return Response.json(
                { message: "Empty Gemini response" },
                { status: 502 }
            );
        }

        const resultadoFinal = JSON.parse(generatedText);

        if (
            !resultadoFinal ||
            !Array.isArray(resultadoFinal.items)
        ) {
            return Response.json(
                { message: "Invalid Gemini response" },
                { status: 502 }
            );
        }

        return Response.json(resultadoFinal);

    } catch (error) {
        console.error("Receipt processing error:", error);

        return Response.json(
            { message: "Server error" },
            { status: 500 }
        );
    }
}
