import { describe, it, expect } from 'vitest';
import { defineCommand } from 'citty';
import { generateFigSpec } from '../src/fig';

describe('Fig Spec Generator', () => {
  it('should generate a valid Fig spec for a simple command', async () => {
    const command = defineCommand({
      meta: {
        name: 'test-cli',
        description: 'A test CLI',
      },
      args: {
        port: {
          type: 'string',
          description: 'Port number',
          required: true,
        },
        host: {
          type: 'string',
          description: 'Host name',
          alias: 'H',
        },
      },
    });

    const spec = await generateFigSpec(command);
    const parsed = JSON.parse(spec);

    expect(parsed).toMatchObject({
      name: 'test-cli',
      description: 'A test CLI',
      options: expect.arrayContaining([
        {
          name: '--port',
          description: 'Port number',
          isRequired: true,
        },
        {
          name: '--host',
          description: 'Host name',
        },
        {
          name: '-H',
          description: 'Host name',
        },
      ]),
    });
  });

  it('should generate a valid Fig spec for a command with subcommands', async () => {
    const command = defineCommand({
      meta: {
        name: 'test-cli',
        description: 'A test CLI',
      },
      subCommands: {
        dev: defineCommand({
          meta: {
            name: 'dev',
            description: 'Development mode',
          },
          args: {
            port: {
              type: 'string',
              description: 'Port number',
            },
          },
        }),
        build: defineCommand({
          meta: {
            name: 'build',
            description: 'Build mode',
          },
          args: {
            output: {
              type: 'positional',
              description: 'Output directory',
              required: true,
            },
          },
        }),
      },
    });

    const spec = await generateFigSpec(command);
    const parsed = JSON.parse(spec);

    expect(parsed).toMatchObject({
      name: 'test-cli',
      description: 'A test CLI',
      subcommands: expect.arrayContaining([
        {
          name: 'test-cli dev',
          description: 'Development mode',
          options: [
            {
              name: '--port',
              description: 'Port number',
            },
          ],
        },
        {
          name: 'test-cli build',
          description: 'Build mode',
          args: [
            {
              name: 'output',
              description: 'Output directory',
              isOptional: false,
              isVariadic: false,
            },
          ],
        },
      ]),
    });
  });
});
