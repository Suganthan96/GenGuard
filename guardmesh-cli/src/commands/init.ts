import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { getTemplate } from '../templates';

export async function initCommand(name?: string, options?: any) {
  const spinner = ora();

  try {
    // Prompt for project name if not provided
    let projectName: string;
    if (!name) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'projectName',
          message: 'Project name:',
          default: 'my-guardmesh-agent',
        },
      ]);
      projectName = answers.projectName;
    } else {
      projectName = name;
    }

    const targetDir = path.join(process.cwd(), options?.dir || '.', projectName);

    // Check if directory exists
    if (fs.existsSync(targetDir)) {
      console.log(chalk.red(`✗ Directory ${projectName} already exists`));
      return;
    }

    spinner.start('Creating project structure...');

    // Create project directory
    fs.mkdirSync(targetDir, { recursive: true });

    // Get template files
    const template = getTemplate(options?.template || 'custom');

    // Create directories
    fs.mkdirSync(path.join(targetDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(targetDir, 'policies'), { recursive: true });
    fs.mkdirSync(path.join(targetDir, 'tests'), { recursive: true });

    // Write template files
    fs.writeFileSync(
      path.join(targetDir, 'agent.yaml'),
      template.agentConfig
    );

    fs.writeFileSync(
      path.join(targetDir, 'src', 'index.ts'),
      template.agentCode
    );

    fs.writeFileSync(
      path.join(targetDir, 'policies', 'policy.yaml'),
      template.policyConfig
    );

    fs.writeFileSync(
      path.join(targetDir, 'package.json'),
      template.packageJson(projectName)
    );

    fs.writeFileSync(
      path.join(targetDir, '.env.example'),
      template.envExample
    );

    fs.writeFileSync(
      path.join(targetDir, 'README.md'),
      template.readme(projectName)
    );

    fs.writeFileSync(
      path.join(targetDir, '.gitignore'),
      'node_modules\n.env\ndist\n*.log\n'
    );

    spinner.succeed(chalk.green(`✓ Created ${projectName}`));

    console.log('\n' + chalk.bold('Next steps:'));
    console.log(chalk.dim('  cd ' + projectName));
    console.log(chalk.dim('  npm install'));
    console.log(chalk.dim('  cp .env.example .env'));
    console.log(chalk.dim('  # Edit .env with your configuration'));
    console.log(chalk.dim('  guardmesh agent register -i your-agent-id -r your-role'));
    console.log(chalk.dim('  guardmesh test action -a your-agent-id --action read_file --target test.txt'));
    console.log(chalk.dim('  guardmesh deploy'));

    console.log('\n' + chalk.bold('Template:'), chalk.cyan(options?.template || 'custom'));
    console.log(chalk.dim('Learn more: https://github.com/yourusername/guardmesh\n'));

  } catch (error) {
    spinner.fail(chalk.red('Failed to create project'));
    console.error(error);
    process.exit(1);
  }
}
