#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init';
import { agentCommand } from './commands/agent';
import { testCommand } from './commands/test';
import { deployCommand } from './commands/deploy';
import { auditCommand } from './commands/audit';
import { guardiansCommand } from './commands/guardians';
import { configCommand } from './commands/config';

const program = new Command();

program
  .name('guardmesh')
  .description('CLI framework for building governed AI agents on 0G')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize a new GuardMesh agent project')
  .argument('[name]', 'Project name')
  .option('-t, --template <type>', 'Agent template (code-analyzer, data-bot, custom)', 'custom')
  .option('-d, --dir <path>', 'Target directory', '.')
  .action(initCommand);

const agent = program
  .command('agent')
  .description('Manage agents and policies');

agent
  .command('register')
  .description('Register a new agent with policy')
  .requiredOption('-i, --id <agentId>', 'Agent ID')
  .requiredOption('-r, --role <role>', 'Role scope')
  .option('-a, --allowed <actions>', 'Comma-separated allowed actions')
  .option('-d, --denied <actions>', 'Comma-separated denied actions')
  .action(agentCommand.register);

agent
  .command('list')
  .description('List all registered agents')
  .action(agentCommand.list);

agent
  .command('info')
  .description('Get agent details')
  .argument('<agentId>', 'Agent ID')
  .action(agentCommand.info);

const test = program
  .command('test')
  .description('Test agent actions against guardians');

test
  .command('action')
  .description('Test a single action')
  .requiredOption('-a, --agent <agentId>', 'Agent ID')
  .requiredOption('--action <type>', 'Action type')
  .requiredOption('--target <resource>', 'Target resource')
  .option('--payload <json>', 'Action payload (JSON)')
  .action(testCommand.action);

test
  .command('policy')
  .description('Test agent policy configuration')
  .requiredOption('-a, --agent <agentId>', 'Agent ID')
  .option('-f, --file <path>', 'Policy file path')
  .action(testCommand.policy);

program
  .command('deploy')
  .description('Deploy agent with governance')
  .option('-c, --config <path>', 'Agent config file', 'agent.yaml')
  .option('--dry-run', 'Simulate deployment without executing')
  .action(deployCommand);

const audit = program
  .command('audit')
  .description('Query audit trail and decisions');

audit
  .command('watch')
  .description('Watch live audit feed')
  .option('-a, --agent <agentId>', 'Filter by agent ID')
  .option('-o, --outcome <type>', 'Filter by outcome (approved, blocked, pending)')
  .action(auditCommand.watch);

audit
  .command('history')
  .description('Query audit history')
  .option('-a, --agent <agentId>', 'Filter by agent ID')
  .option('-l, --limit <number>', 'Number of records', '20')
  .action(auditCommand.history);

audit
  .command('verify')
  .description('Verify audit decision on 0G Storage')
  .argument('<merkleRoot>', 'Decision merkle root')
  .action(auditCommand.verify);

const guardians = program
  .command('guardians')
  .description('Manage guardian nodes');

guardians
  .command('status')
  .description('Show guardian node status')
  .action(guardiansCommand.status);

guardians
  .command('add')
  .description('Add a guardian node')
  .requiredOption('-p, --pubkey <key>', 'Public key')
  .requiredOption('-e, --ens <name>', 'ENS name')
  .option('--endpoint <url>', 'API endpoint')
  .action(guardiansCommand.add);

guardians
  .command('remove')
  .description('Remove a guardian node')
  .argument('<pubkey>', 'Public key')
  .action(guardiansCommand.remove);

program
  .command('config')
  .description('Configure GuardMesh CLI')
  .option('--rpc <url>', 'Set RPC endpoint')
  .option('--registry <address>', 'Set registry contract address')
  .option('--audit <address>', 'Set audit contract address')
  .option('--show', 'Show current configuration')
  .action(configCommand);

program.parse();
