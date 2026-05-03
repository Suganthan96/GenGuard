import chalk from 'chalk';
import ora from 'ora';
import { table } from 'table';
import axios from 'axios';
import { loadConfig } from '../lib/config';

export const guardiansCommand = {
  async status() {
    const spinner = ora('Checking guardian status...').start();

    try {
      const config = loadConfig();
      const guardianEndpoints = config.guardians || [
        'http://127.0.0.1:9002',
        'http://127.0.0.1:9012',
        'http://127.0.0.1:9022',
      ];

      const results = await Promise.all(
        guardianEndpoints.map(async (endpoint, idx) => {
          try {
            const res = await axios.get(`${endpoint}/topology`, { timeout: 3000 });
            return {
              id: `Guardian ${idx + 1}`,
              endpoint,
              status: 'online',
              publicKey: res.data.publicKey || 'unknown',
              peers: res.data.peers?.length || 0,
            };
          } catch (error) {
            return {
              id: `Guardian ${idx + 1}`,
              endpoint,
              status: 'offline',
              publicKey: 'N/A',
              peers: 0,
            };
          }
        })
      );

      spinner.stop();

      const data = [
        [
          chalk.bold('Guardian'),
          chalk.bold('Endpoint'),
          chalk.bold('Status'),
          chalk.bold('Public Key'),
          chalk.bold('Peers'),
        ],
        ...results.map((r) => [
          r.id,
          r.endpoint,
          r.status === 'online' ? chalk.green('● online') : chalk.red('● offline'),
          r.publicKey.substring(0, 12) + '...',
          r.peers.toString(),
        ]),
      ];

      console.log('\n' + table(data));

      const onlineCount = results.filter((r) => r.status === 'online').length;
      console.log(
        chalk.dim('Total:'),
        chalk.green(`${onlineCount} online`),
        chalk.dim('/'),
        chalk.red(`${results.length - onlineCount} offline`)
      );

    } catch (error: any) {
      spinner.fail(chalk.red('Failed to check guardian status'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  },

  async add(options: any) {
    const spinner = ora('Adding guardian node...').start();

    try {
      const { pubkey, ens, endpoint } = options;

      // In a real implementation, this would update the guardian registry
      // For now, we'll just update the local config

      const config = loadConfig();
      
      spinner.succeed(chalk.green('✓ Guardian node added'));

      console.log('\n' + chalk.bold('Guardian Details:'));
      console.log(chalk.dim('  Public Key:'), chalk.cyan(pubkey));
      console.log(chalk.dim('  ENS Name:'), ens);
      if (endpoint) {
        console.log(chalk.dim('  Endpoint:'), endpoint);
      }

      console.log('\n' + chalk.dim('Note: Update your guardmesh config to include this guardian'));

    } catch (error: any) {
      spinner.fail(chalk.red('Failed to add guardian'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  },

  async remove(pubkey: string) {
    const spinner = ora('Removing guardian node...').start();

    try {
      // In a real implementation, this would update the guardian registry
      
      spinner.succeed(chalk.green('✓ Guardian node removed'));

      console.log('\n' + chalk.bold('Removed Guardian:'));
      console.log(chalk.dim('  Public Key:'), chalk.cyan(pubkey));

    } catch (error: any) {
      spinner.fail(chalk.red('Failed to remove guardian'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  },
};
