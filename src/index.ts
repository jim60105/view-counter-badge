import { StyleOption, badgen } from 'badgen';
import {
  Request as WorkerRequest,
  D1Database,
  ExecutionContext
} from '@cloudflare/workers-types/experimental';

/**
 * Environment variables type definition.
 */
export interface Env {
  ViewCounter: D1Database;
}

/**
 * The name of the counter to use.
 * Feel free to change this to a unique name for your own counter.
 */
const CounterName = 'Counter1';

export default {
  /**
   * Fetches the view count and generates an SVG badge.
   * @param request The incoming request.
   * @param env The environment variables.
   * @param ctx The execution context.
   * @returns A response containing the SVG badge.
   */
  async fetch(request: WorkerRequest, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Step the count
    let count: number | null = await getCountFromD1(env);
    count = await stepCount(count, env);
    console.log('Count', count);

    // Get the query parameters
    const params = readQueryParams(request);
    console.log('Params', params);

    // Generate the svg string
    const svgString = badgen({
      ...params,
      status: count.toString()
    });
    console.log('SVG', svgString);

    return new Response(svgString, {
      headers: {
        'content-type': 'image/svg+xml;charset=utf-8',
        'access-control-allow-origin': '*',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
      }
    });
  }
};

/**
 * Gets the current count from the ViewCounter.
 * @param env The environment variables.
 * @returns The current count, or null if it doesn't exist.
 */
const getCountFromD1 = async (env: Env): Promise<number | null> =>
  await env.ViewCounter.prepare('SELECT * FROM ViewCounter WHERE Name = ?1')
    .bind(CounterName)
    .first('Value');

/**
 * Increments the count and updates the ViewCounter.
 * @param count The current count.
 * @param env The environment variables.
 * @returns The new count.
 */
const stepCount = async (count: number | null, env: Env): Promise<number> => {
  // If the value is null, insert a new record
  if (!count) {
    var result = await env.ViewCounter.prepare(
      'INSERT INTO ViewCounter (Name, Value) VALUES (?1, 1)'
    )
      .bind(CounterName)
      .run();

    console.log('Insert result', result);
  } else {
    // Step the count in the database
    var result = await env.ViewCounter.prepare(
      'UPDATE ViewCounter SET Value = (SELECT Value FROM ViewCounter WHERE Name = ?1) + 1 WHERE Name = ?1'
    )
      .bind(CounterName)
      .run();

    console.log('Update result', result);
  }

  return (count || 0) + 1;
};

/**
 * Reads the query parameters from the request.
 * @param request The incoming request.
 * @returns The query parameters.
 */
const readQueryParams: (
  request: WorkerRequest
) => {
  label: string;
  labelColor: string;
  color: string;
  style: StyleOption;
  scale: number;
} = request => {
  const { searchParams } = new URL(request.url);
  return {
    label: searchParams.get('label') || 'Views',
    labelColor: searchParams.get('labelColor') || '555',
    color: searchParams.get('color') || 'blue',
    style: searchParams.get('style') === 'classic' ? 'classic' : 'flat',
    scale: parseFloat(searchParams.get('scale') || '1')
  };
};
