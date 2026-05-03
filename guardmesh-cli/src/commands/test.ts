import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';
import { getContract } from '../lib/contract';
import { loadConfig } from '../lib/config';

export const testCommand = {
  async action(options: any) {
    const spinner = ora('Testing action against guardians...').start();

    try {
      const config = loadConfig();
      const { agent, action, target, payload } = options;

      // Build intent payload
      const intent = {
        agentId: agent,
        actionType: action,
        target: target,
        payload: payload ? JSON.parse(payload) : {},
        timestamp: Date.now(),
      };

      spinner.text = 'Submitting to guardian mesh...';

      // Submit to guardian nodes (via AXL mesh)
      const guardianEndpoints = config.guardians || ['http://127.0.0.1:9002'];
      
      const responses = await Promise.all(
        guardianEndpoints.map(async (endpoint) => {
          try {
            const res = await axios.post(`${endpoint}/a2a/send`, {
              intent,
            }, { timeout: 5000 });
            return { endpoint, success: true, data: res.data };
          } catch (error: any) {
            return { endpoint, success: false, error: error.message };
          }
        })
      );

      spinner.stop();

      console.log('\n' + chalk.bold('Test Results:'));
      console.log(chalk.dim('  Agent:'), chalk.cyan(agent));
      console.log(chalk.dim('  Action:'), action);
      console.log(chalk.dim('  Target:'), target);

      console.log('\n' + chalk.bold('Guardian Responses:'));
      
      let approveCount = 0;
      let blockCount = 0;

      responses.forEach((res, idx) => {
        if (res.success) {
          const verdict = res.data.verdict || 'unknown';
          const approved = verdict === 'approve';
          
          if (approved) approveCount++;
          else blockCount++;

          console.log(
            chalk.dim(`  Guardian ${idx + 1}:`),
            approved ? chalk.green('✓ APPROVE') : chalk.red('✗ BLOCK'),
            chalk.dim(`(${res.endpoint})`)
          );
          
          if (res.data.reason) {
            console.log(chalk.dim('    Reason:'), res.data.reason);
          }
        } else {
          console.log(
            chalk.dim(`  Guardian ${idx + 1}:`),
            chalk.yellow('⚠ ERROR'),
            chalk.dim(`(${res.endpoint})`)
          );
          console.log(chalk.dim('    Error:'), res.error);
        }
      });

      console.log('\n' + chalk.bold('Consensus:'));
      console.log(chalk.dim('  Approve:'), chalk.green(approveCount));
      console.log(chalk.dim('  Block:'), chalk.red(blockCount));

      const outcome = approveCount > blockCount ? 'APPROVED' : 'BLOCKED';
      console.log(
        chalk.dim('  Outcome:'),
        outcome === 'APPROVED' ? chalk.green(outcome) : chalk.red(outcome)
      );

    } catch (error: any) {
      spinner.fail(chalk.red('Test failed'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  },

  async policy(options: any) {
    const spinner = ora('Testing policy configuration...').start();

    try {
      const config = loadConfig();
      const registry = await getContract('registry', config);

      const { agent } = options;

      // Get agent policy
      const agentData = await registry.getAgent(agent);

      spinner.stop();

      console.log('\n' + chalk.bold('Policy Test:'));
      console.log(chalk.dim('  Agent:'), chalk.cyan(agent));
      console.log(chalk.dim('  Role:'), agentData.roleScope);

      // Test common actions
      const testActions = [
        'read_file',
        'write_file',
        'execute_code',
        'query_db',
        'change_permissions',
      ];

      console.log('\n' + chalk.bold('Action Permissions:'));

      testActions.forEach((action) => {
        const allowed = agentData.allowedActions.includes(action);
        const denied = agentData.deniedActions.includes(action);

        let status = chalk.yellow('⚠ UNSPECIFIED');
        if (allowed) status = chalk.green('✓ ALLOWED');
        if (denied) status = chalk.red('✗ DENIED');

        console.log(chalk.dim(`  ${action}:`), status);
      });

    } catch (error: any) {
      spinner.fail(chalk.red('Policy test failed'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  },
};
