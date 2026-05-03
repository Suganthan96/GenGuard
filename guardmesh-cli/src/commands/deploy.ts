import fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import yaml from 'yaml';
import { getContract } from '../lib/contract';
import { loadConfig } from '../lib/config';

export async function deployCommand(options: any) {
  const spinner = ora('Loading agent configuration...').start();

  try {
    const configPath = options.config || 'agent.yaml';

    if (!fs.existsSync(configPath)) {
      spinner.fail(chalk.red(`Configuration file not found: ${configPath}`));
      process.exit(1);
    }

    const agentConfig = yaml.parse(fs.readFileSync(configPath, 'utf8'));

    spinner.text = 'Validating configuration...';

    // Validate required fields
    if (!agentConfig.agentId || !agentConfig.roleScope) {
      spinner.fail(chalk.red('Invalid configuration: agentId and roleScope are required'));
      process.exit(1);
    }

    if (options.dryRun) {
      spinner.stop();
      console.log('\n' + chalk.bold.yellow('DRY RUN - No changes will be made'));
    }

    console.log('\n' + chalk.bold('Deployment Plan:'));
    console.log(chalk.dim('  Agent ID:'), chalk.cyan(agentConfig.agentId));
    console.log(chalk.dim('  Role:'), agentConfig.roleScope);
    console.log(chalk.dim('  Allowed:'), agentConfig.allowedActions?.join(', ') || 'none');
    console.log(chalk.dim('  Denied:'), agentConfig.deniedActions?.join(', ') || 'none');
    console.log(chalk.dim('  Consensus:'), agentConfig.consensusType || 'majority');

    if (options.dryRun) {
      console.log(chalk.yellow('\n✓ Dry run completed - no changes made'));
      return;
    }

    spinner.start('Deploying agent...');

    const config = loadConfig();
    const registry = await getContract('registry', config);

    // Register agent
    const tx = await registry.registerAgent(
      agentConfig.agentId,
      agentConfig.roleScope,
      agentConfig.allowedActions || [],
      agentConfig.deniedActions || []
    );

    spinner.text = 'Waiting for confirmation...';
    const receipt = await tx.wait();

    spinner.succeed(chalk.green('✓ Agent deployed successfully'));

    console.log('\n' + chalk.bold('Deployment Details:'));
    console.log(chalk.dim('  Transaction:'), chalk.cyan(receipt.hash));
    console.log(chalk.dim('  Block:'), receipt.blockNumber);
    console.log(chalk.dim('  Gas Used:'), receipt.gasUsed.toString());

    console.log('\n' + chalk.bold('Next Steps:'));
    console.log(chalk.dim('  • Test your agent:'), `guardmesh test action -a ${agentConfig.agentId} --action read_file --target test.txt`);
    console.log(chalk.dim('  • Watch audit feed:'), `guardmesh audit watch -a ${agentConfig.agentId}`);
    console.log(chalk.dim('  • View dashboard:'), 'http://localhost:3000/home/guardians');

  } catch (error: any) {
    spinner.fail(chalk.red('Deployment failed'));
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}
