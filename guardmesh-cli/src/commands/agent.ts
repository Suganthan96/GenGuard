import chalk from 'chalk';
import ora from 'ora';
import { table } from 'table';
import { getContract } from '../lib/contract';
import { loadConfig } from '../lib/config';

export const agentCommand = {
  async register(options: any) {
    const spinner = ora('Registering agent...').start();

    try {
      const config = loadConfig();
      const registry = await getContract('registry', config);

      const { id, role, allowed, denied } = options;

      const allowedActions = allowed ? allowed.split(',').map((a: string) => a.trim()) : [];
      const deniedActions = denied ? denied.split(',').map((a: string) => a.trim()) : [];

      // Register agent on-chain
      const tx = await registry.registerAgent(id, role, allowedActions, deniedActions);
      
      spinner.text = 'Waiting for transaction confirmation...';
      await tx.wait();

      spinner.succeed(chalk.green('✓ Agent registered successfully'));

      console.log('\n' + chalk.bold('Agent Details:'));
      console.log(chalk.dim('  Agent ID:'), chalk.cyan(id));
      console.log(chalk.dim('  Role:'), role);
      console.log(chalk.dim('  Allowed:'), allowedActions.join(', ') || 'none');
      console.log(chalk.dim('  Denied:'), deniedActions.join(', ') || 'none');
      console.log(chalk.dim('  Tx Hash:'), tx.hash);

    } catch (error: any) {
      spinner.fail(chalk.red('Failed to register agent'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  },

  async list() {
    const spinner = ora('Fetching agents...').start();

    try {
      const config = loadConfig();
      const registry = await getContract('registry', config);

      // Get all agents (implement pagination if needed)
      const agents = await registry.getAllAgents();

      spinner.stop();

      if (agents.length === 0) {
        console.log(chalk.yellow('No agents registered yet'));
        return;
      }

      const data = [
        [
          chalk.bold('Agent ID'),
          chalk.bold('Role'),
          chalk.bold('Status'),
          chalk.bold('Allowed Actions'),
        ],
        ...agents.map((agent: any) => [
          chalk.cyan(agent.agentId),
          agent.roleScope,
          agent.active ? chalk.green('active') : chalk.red('inactive'),
          agent.allowedActions.slice(0, 3).join(', ') + (agent.allowedActions.length > 3 ? '...' : ''),
        ]),
      ];

      console.log('\n' + table(data));

    } catch (error: any) {
      spinner.fail(chalk.red('Failed to fetch agents'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  },

  async info(agentId: string) {
    const spinner = ora('Fetching agent details...').start();

    try {
      const config = loadConfig();
      const registry = await getContract('registry', config);

      const agent = await registry.getAgent(agentId);

      spinner.stop();

      console.log('\n' + chalk.bold('Agent Information:'));
      console.log(chalk.dim('  Agent ID:'), chalk.cyan(agent.agentId));
      console.log(chalk.dim('  Role Scope:'), agent.roleScope);
      console.log(chalk.dim('  Status:'), agent.active ? chalk.green('active') : chalk.red('inactive'));
      console.log(chalk.dim('  Consensus:'), agent.consensusType);
      
      console.log('\n' + chalk.bold('Allowed Actions:'));
      agent.allowedActions.forEach((action: string) => {
        console.log(chalk.green('  ✓'), action);
      });

      console.log('\n' + chalk.bold('Denied Actions:'));
      agent.deniedActions.forEach((action: string) => {
        console.log(chalk.red('  ✗'), action);
      });

      console.log('\n' + chalk.bold('Data Sources:'));
      agent.dataSources.forEach((source: string) => {
        console.log(chalk.dim('  •'), source);
      });

    } catch (error: any) {
      spinner.fail(chalk.red('Failed to fetch agent info'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  },
};
