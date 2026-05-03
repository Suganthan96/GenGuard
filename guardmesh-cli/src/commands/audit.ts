import chalk from 'chalk';
import ora from 'ora';
import { table } from 'table';
import axios from 'axios';
import { getContract } from '../lib/contract';
import { loadConfig } from '../lib/config';

export const auditCommand = {
  async watch(options: any) {
    console.log(chalk.bold('Watching audit feed...') + chalk.dim(' (Press Ctrl+C to stop)\n'));

    const config = loadConfig();
    const audit = await getContract('audit', config);

    let lastBlock = 0;

    const poll = async () => {
      try {
        const [decisions] = await audit.getAllDecisionsPaginated(0, 10);

        decisions.forEach((decision: any) => {
          const blockNum = Number(decision.recordedAt);
          if (blockNum > lastBlock) {
            lastBlock = blockNum;

            const outcome = decision.approved ? 'APPROVED' : 'BLOCKED';
            const color = decision.approved ? chalk.green : chalk.red;

            console.log(
              chalk.dim(new Date().toLocaleTimeString()),
              color(outcome),
              chalk.cyan(decision.agentId),
              chalk.dim('→'),
              decision.actionType,
              chalk.dim('→'),
              decision.target || '(none)'
            );

            if (decision.blockedReason) {
              console.log(chalk.dim('  Reason:'), decision.blockedReason);
            }
          }
        });
      } catch (error) {
        // Silently continue on errors
      }
    };

    // Poll every 3 seconds
    setInterval(poll, 3000);
    await poll(); // Initial poll
  },

  async history(options: any) {
    const spinner = ora('Fetching audit history...').start();

    try {
      const config = loadConfig();
      const audit = await getContract('audit', config);

      const limit = parseInt(options.limit || '20');
      const [decisions] = await audit.getAllDecisionsPaginated(0, limit);

      spinner.stop();

      if (decisions.length === 0) {
        console.log(chalk.yellow('No audit records found'));
        return;
      }

      // Filter by agent if specified
      let filtered = decisions;
      if (options.agent) {
        filtered = decisions.filter((d: any) => d.agentId === options.agent);
      }

      const data = [
        [
          chalk.bold('Time'),
          chalk.bold('Agent'),
          chalk.bold('Action'),
          chalk.bold('Target'),
          chalk.bold('Outcome'),
        ],
        ...filtered.map((d: any) => {
          const time = new Date(Number(d.recordedAt) * 1000).toLocaleString();
          const outcome = d.approved ? chalk.green('APPROVED') : chalk.red('BLOCKED');
          
          return [
            time,
            chalk.cyan(d.agentId),
            d.actionType,
            d.target || '(none)',
            outcome,
          ];
        }),
      ];

      console.log('\n' + table(data));

    } catch (error: any) {
      spinner.fail(chalk.red('Failed to fetch audit history'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  },

  async verify(merkleRoot: string) {
    const spinner = ora('Verifying decision on 0G Storage...').start();

    try {
      const config = loadConfig();

      // Call the verification API
      const response = await axios.get(
        `${config.apiUrl || 'http://localhost:3000'}/api/guardmesh/retrieve-bundle`,
        {
          params: { merkleRoot },
        }
      );

      spinner.stop();

      const data = response.data;

      if (!data.ok) {
        console.log(chalk.red('✗ Verification failed'));
        console.log(chalk.dim('  Error:'), data.error);
        return;
      }

      console.log('\n' + chalk.bold('Verification Result:'));
      console.log(chalk.dim('  Merkle Root:'), chalk.cyan(merkleRoot));
      console.log(chalk.dim('  Verified:'), data.verified ? chalk.green('✓ YES') : chalk.red('✗ NO'));

      if (data.bundle) {
        console.log('\n' + chalk.bold('Bundle Data:'));
        console.log(JSON.stringify(data.bundle, null, 2));
      }

      if (data.onChainData) {
        console.log('\n' + chalk.bold('On-Chain Data:'));
        console.log(JSON.stringify(data.onChainData, null, 2));
      }

      if (data.verificationNotes && data.verificationNotes.length > 0) {
        console.log('\n' + chalk.bold('Verification Notes:'));
        data.verificationNotes.forEach((note: string) => {
          console.log(chalk.dim('  •'), note);
        });
      }

    } catch (error: any) {
      spinner.fail(chalk.red('Verification failed'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  },
};
