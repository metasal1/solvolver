import { PublicKey } from '@solana/web3.js';

interface StandardResponse {
    address: string;
    source: 'direct' | 'sns' | 'alldomains' | 'phantom';
    resolveTime: number;
}

function isValidSolanaAddress(address: string): boolean {
    try {
        new PublicKey(address);
        return true;
    } catch {
        return false;
    }
}

export async function GET(
    request: Request
) {
    const startTime = performance.now();

    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*', // Allow all origins
        'Access-Control-Allow-Methods': 'GET', // Allow GET method
        'Access-Control-Allow-Headers': 'Content-Type', // Allow specific headers
    };

    try {
        const searchParams = new URL(request.url).searchParams;
        const address = searchParams.get('address');

        if (!address) {
            return new Response(JSON.stringify({ error: 'Address parameter is required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Direct Solana address
        if (isValidSolanaAddress(address)) {
            const response: StandardResponse = {
                address: address,
                source: 'direct',
                resolveTime: performance.now() - startTime
            };
            return new Response(JSON.stringify(response), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // .sol domains
        if (address.toLowerCase().endsWith('.sol')) {
            const response = await fetch(
                `https://sns-sdk-proxy.bonfida.workers.dev/resolve/${address}`
            );
            const data = await response.json();

            const standardResponse: StandardResponse = {
                address: data.result,
                source: 'sns',
                resolveTime: performance.now() - startTime
            };

            return new Response(JSON.stringify(standardResponse), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Any other domain with a dot
        if (address.includes('.')) {
            const response = await fetch(
                `https://alldomains.id/api/domain-owner/${address}`
            );
            const data = await response.json();

            if (data.status === 'success' && data.owner) {
                const standardResponse: StandardResponse = {
                    address: data.owner,
                    source: 'alldomains',
                    resolveTime: performance.now() - startTime
                };

                return new Response(JSON.stringify(standardResponse), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }
        }

        // Phantom API as fallback
        const response = await fetch(
            `https://api.phantom.app/user/v1/profiles/${address}`
        );
        const data = await response.json();

        const standardResponse: StandardResponse = {
            address: data.addresses['solana:101'],
            source: 'phantom',
            resolveTime: performance.now() - startTime
        };

        return new Response(JSON.stringify(standardResponse), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        return new Response(
            JSON.stringify({
                error: 'Failed to resolve address',
                details: error instanceof Error ? error.message : 'Unknown error',
                resolveTime: performance.now() - startTime
            }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
        );
    }
}
