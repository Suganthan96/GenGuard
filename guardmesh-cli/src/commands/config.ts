import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { loadConfig, saveConfig } from '../lib/config';

export async function configCommand(options: any) {
  try {
    if (options.show) {
      const config = loadConfig();

      console.log('\n' + chalk.bold('GuardMesh Configuration:'));
      console.log(chalk.dim('  RPC URL:'), config.rpcUrl || chalk.yellow('not set'));
      console.log(chalk.dim('  Registry:'), config.registryAddress || chalk.yellow('not set'));
      console.log(chalk.dim('  Audit:'), config.auditAddress || chalk.yellow('not set'));
      console.log(chalk.dim('  API URL:'), config.apiUrl || chalk.yellow('not set'));
      
      if (config.guardians && config.guardians.length > 0) {
        console.log(chalk.dim('  Guardians:'));
        config.guardians.forEach((g: string) => {
          console.log(chalk.dim('    •'), g);
        });
      }

      console.log(chalk.dim('\nConfig file:'), getConfigPath());
      return;
    }

    const config = loadConfig();
    let updated = false;

    if (options.rpc) {
      config.rpcUrl = options.rpc;
      updated = true;
      console.log(chalk.green('✓'), 'RPC URL updated:', chalk.cyan(options.rpc));
    }

    if (options.registry) {
      config.registryAddress = options.registry;
      updated = true;
      console.log(chalk.green('✓'), 'Registry address updated:', chalk.cyan(options.registry));
    }

    if (options.audit) {
      config.auditAddress = options.audit;
      updated = true;
      console.log(chalk.green('✓'), 'Audit address updated:', chalk.cyan(options.audit));
    }

    if (updated) {
      saveConfig(config);
      console.log('\n' + chalk.green('Configuration saved'));
    } else {
      console.log(chalk.yellow('No changes made. Use --show to view current config.'));
    }

  } catch (error: any) {
    console.error(chalk.red('Failed to update configuration'));
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

function getConfigPath(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  return path.join(homeDir, '.guardmesh', 'config.json');
}
