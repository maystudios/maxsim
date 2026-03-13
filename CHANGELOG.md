## [5.0.7](https://github.com/maystudios/maxsimcli/compare/v5.0.6...v5.0.7) (2026-03-13)


### Bug Fixes

* **website:** unify header, remove gradient/twitter, add drift detection tile ([67d115d](https://github.com/maystudios/maxsimcli/commit/67d115d99e2d47855efaf31005dab6219dd057e4))

## [5.0.6](https://github.com/maystudios/maxsimcli/compare/v5.0.5...v5.0.6) (2026-03-12)


### Bug Fixes

* correct all critical template-CLI discrepancies (K1-K5) ([f298990](https://github.com/maystudios/maxsimcli/commit/f2989908b03ac2772c6b2d3091b2169f0871c1ec))

## [5.0.5](https://github.com/maystudios/maxsimcli/compare/v5.0.4...v5.0.5) (2026-03-12)


### Bug Fixes

* correct template-CLI argument discrepancies (D1, D2, D3) ([a2936fb](https://github.com/maystudios/maxsimcli/commit/a2936fbf729effc8229f3af8752f67f253773f0a))

## [5.0.4](https://github.com/maystudios/maxsimcli/compare/v5.0.3...v5.0.4) (2026-03-12)


### Bug Fixes

* **agents:** correct skill path prefix in available_skills frontmatter ([37d4a84](https://github.com/maystudios/maxsimcli/commit/37d4a84255b85990e6aafd1467617f3b0b6398c4))
* **commands:** use absolute [@path](https://github.com/path) refs so commands resolve after install ([ff86aae](https://github.com/maystudios/maxsimcli/commit/ff86aaee0d02aae064ee1ac82bfba7730f1f2a42))
* **hooks:** prevent console window flashes on Windows ([35a2591](https://github.com/maystudios/maxsimcli/commit/35a2591e18fe81cce5e0a10ae81595852804dcfa))
* **workflows:** correct [@path](https://github.com/path) references to use ~/.claude/maxsim/ prefix ([9fdacc0](https://github.com/maystudios/maxsimcli/commit/9fdacc08f0adc6236288f4edcfef7a5845531797))

## [5.0.3](https://github.com/maystudios/maxsimcli/compare/v5.0.2...v5.0.3) (2026-03-12)


### Bug Fixes

* **templates:** rewrite [@path](https://github.com/path) references to resolve correctly after install ([11aeffa](https://github.com/maystudios/maxsimcli/commit/11aeffad7b355ccbbd3c1c9cab58419113360eb3))

## [5.0.2](https://github.com/maystudios/maxsimcli/compare/v5.0.1...v5.0.2) (2026-03-12)


### Bug Fixes

* **github-ssot:** complete migration to GitHub Issues as sole source of truth ([2bf86bf](https://github.com/maystudios/maxsimcli/commit/2bf86bf6065048e859a2b760b2c4a04209c6da87))
* **todos:** remove local file system — GitHub Issues is sole source of truth ([de98df1](https://github.com/maystudios/maxsimcli/commit/de98df18f88040b58cea32d576907a889151e9f9))

## [5.0.1](https://github.com/maystudios/maxsimcli/compare/v5.0.0...v5.0.1) (2026-03-12)


### Bug Fixes

* **install:** update Discord community link ([3c548ab](https://github.com/maystudios/maxsimcli/commit/3c548ab608223780534ac8c5b1c79ad2bf66f338))

# [5.0.0](https://github.com/maystudios/maxsimcli/compare/v4.16.0...v5.0.0) (2026-03-12)


* feat!: replace MCP server with CLI github commands ([2fc6a0e](https://github.com/maystudios/maxsimcli/commit/2fc6a0eeafbd5e7f010406f8c097fa3aad654db3))


### Bug Fixes

* **e2e:** remove stale MCP server tests and update install assertions ([32f6fe1](https://github.com/maystudios/maxsimcli/commit/32f6fe1226da022aef46b831dbeec39e052401a4))


### Features

* add sound notification hooks for AskUserQuestion and Stop events ([6e96a6e](https://github.com/maystudios/maxsimcli/commit/6e96a6e7e5147eefae5a1e073927ce99ceedaf49))
* make GitHub Issues single source of truth for task/plan tracking ([8409c10](https://github.com/maystudios/maxsimcli/commit/8409c107305ff1183f2997d92a1515979ce2dc28))


### BREAKING CHANGES

* MCP server removed. GitHub operations now use
`node maxsim-tools.cjs github <command>` instead of MCP tools.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>

# [4.16.0](https://github.com/maystudios/maxsimcli/compare/v4.15.4...v4.16.0) (2026-03-12)


### Features

* make GitHub Issues single source of truth for task/plan tracking ([d8e7191](https://github.com/maystudios/maxsimcli/commit/d8e7191467b12b2ba6c147a65f5e6539f77470ad))

## [4.15.4](https://github.com/maystudios/maxsimcli/compare/v4.15.3...v4.15.4) (2026-03-12)


### Bug Fixes

* remove stale references to dashboard, plan-phase, milestones shims and enhance statusline ([b895bf2](https://github.com/maystudios/maxsimcli/commit/b895bf22228117e93ad36cfb358777a4591109ed))

## [4.15.3](https://github.com/maystudios/maxsimcli/compare/v4.15.2...v4.15.3) (2026-03-11)


### Bug Fixes

* **workflows:** move init CLI call into router to prevent workflow freelancing ([242e943](https://github.com/maystudios/maxsimcli/commit/242e9438968e90012c7ccc5b3180380a628c7154))

## [4.15.2](https://github.com/maystudios/maxsimcli/compare/v4.15.1...v4.15.2) (2026-03-11)


### Bug Fixes

* **workflows:** add missing GitHub fields to init workflow Parse JSON instructions ([539487b](https://github.com/maystudios/maxsimcli/commit/539487bb0bc59e818cab72e1e0969f9c2e69760a))

## [4.15.1](https://github.com/maystudios/maxsimcli/compare/v4.15.0...v4.15.1) (2026-03-11)


### Bug Fixes

* **workflows:** add missing "In Review" board transition before verification ([70031e6](https://github.com/maystudios/maxsimcli/commit/70031e6691334834281cc74d94f0985d6bc531d2))

# [4.15.0](https://github.com/maystudios/maxsimcli/compare/v4.14.0...v4.15.0) (2026-03-11)


### Features

* **agents:** update agent prompts for GitHub I/O, create github-artifact-protocol skill, update installer ([2eaf852](https://github.com/maystudios/maxsimcli/commit/2eaf852bd04d129a5b9b95ceb62e0b14a2aced6f))

# [4.14.0](https://github.com/maystudios/maxsimcli/compare/v4.13.0...v4.14.0) (2026-03-11)


### Features

* **workflows:** rewrite execute workflows for GitHub-first plan reading, per-task board transitions, and summary posting ([9d47215](https://github.com/maystudios/maxsimcli/commit/9d472159835a65058cd5d72a7a2265e4d58394c4))

# [4.13.0](https://github.com/maystudios/maxsimcli/compare/v4.12.0...v4.13.0) (2026-03-11)


### Features

* **workflows:** rewrite progress, go, and verify workflows for live GitHub reads and comment posting ([4804a40](https://github.com/maystudios/maxsimcli/commit/4804a40fde7075fce21a3c2ebcb400937f271ab1))

# [4.12.0](https://github.com/maystudios/maxsimcli/compare/v4.11.0...v4.12.0) (2026-03-11)


### Features

* **workflows:** rewrite plan workflows for GitHub-first artifact storage and stage detection ([289fc7e](https://github.com/maystudios/maxsimcli/commit/289fc7e4fbc583e2b182d4a73ebdfc0d85123d2b))

# [4.11.0](https://github.com/maystudios/maxsimcli/compare/v4.10.0...v4.11.0) (2026-03-11)


### Features

* **workflows:** wire mcp_github_setup and phase issue creation into init workflows ([fe30a97](https://github.com/maystudios/maxsimcli/commit/fe30a979957e9a480fc6e98bc9e60d51d2f428e2))

# [4.10.0](https://github.com/maystudios/maxsimcli/compare/v4.9.0...v4.10.0) (2026-03-11)


### Features

* add realignment phases 7-10 from drift report ([e3e87e1](https://github.com/maystudios/maxsimcli/commit/e3e87e18249dcf971700c8cf413aa96d42e054c3))
* **init:** add GitHub mapping data to workflow init contexts ([ccc25ed](https://github.com/maystudios/maxsimcli/commit/ccc25ed300a82ced53d1338614b64910cba98da3))
* **mcp:** enhance GitHub tools and add batch-create, external-edit-detection, sync-check tools ([b3edaf9](https://github.com/maystudios/maxsimcli/commit/b3edaf9479f39b7a183013c98c83007c247ae82e))

# [4.9.0](https://github.com/maystudios/maxsimcli/compare/v4.8.0...v4.9.0) (2026-03-11)


### Bug Fixes

* **04-02:** adjust roadmap-writing description line break for trigger matching ([db7117e](https://github.com/maystudios/maxsimcli/commit/db7117edd5e37e759aa22baf19860cbf801b2c4f))
* **04-03:** add 8 internal skills to builtInSkills array ([5717cbd](https://github.com/maystudios/maxsimcli/commit/5717cbd9f7071eec8a788005dc3e51838761aec6))
* **04-05:** update remaining old agent names in templates ([ba4e42e](https://github.com/maystudios/maxsimcli/commit/ba4e42ef6505ac68707cd995a55448e3936548a9))
* **05-04:** fix evidence section regex for end-of-file matching ([3660c07](https://github.com/maystudios/maxsimcli/commit/3660c0743e1136f743146c93f54d765f8bf641d5))
* **hooks:** wire backup into install flow, fix spawn pattern and stale comment ([44764d5](https://github.com/maystudios/maxsimcli/commit/44764d58c59385665c63464a1c0d0c33d68ccacc))
* **tests:** update stale file count assertions in E2E install tests ([e81b420](https://github.com/maystudios/maxsimcli/commit/e81b42007d4b702ce4996412f51a4cc377c0ee90))


### Features

* **03-01:** create /maxsim:plan command template and thin orchestrator workflow ([051ea00](https://github.com/maystudios/maxsimcli/commit/051ea000c8c66d31962bfeb28b306679030ae693))
* **03-01:** create plan stage sub-workflows for discussion, research, and planning ([252cdac](https://github.com/maystudios/maxsimcli/commit/252cdac1da8e6e1a9d8de30e95968056a061fdab))
* **03-02:** create unified /maxsim:init command and thin router workflow ([446490b](https://github.com/maystudios/maxsimcli/commit/446490ba0d9cf3132613b4a9e05b09671626b48b))
* **03-03:** create /maxsim:execute command template and state-machine workflow ([d5b915c](https://github.com/maystudios/maxsimcli/commit/d5b915c447e1842ba6de3401cc842126021699e2))
* **03-04:** create /maxsim:go auto-detection command and workflow ([d501f16](https://github.com/maystudios/maxsimcli/commit/d501f16450f865f366d06dbf11e7567650f8bbca))
* **03-04:** rewrite /maxsim:help for 9-command surface ([f37fbd9](https://github.com/maystudios/maxsimcli/commit/f37fbd99a77a55d30a4dade7ddf93ab4b5868922))
* **03-05:** enhance /maxsim:quick with todo capture mode ([0f8170d](https://github.com/maystudios/maxsimcli/commit/0f8170dbe329a8b5da23359ebf834bd17645a7fc))
* **03-05:** enhance progress and settings with absorbed capabilities ([41e0bd8](https://github.com/maystudios/maxsimcli/commit/41e0bd8ee6f353c8343f694d393e3ddb74ceaf15))
* **03-06:** delete 33 old command files and 21 obsolete workflow files ([fb7bf84](https://github.com/maystudios/maxsimcli/commit/fb7bf8417fb12c8b8164b7666500eb9e295544bd))
* **03-08:** add orphan cleanup for deleted v5.0 command and workflow files ([80e3e92](https://github.com/maystudios/maxsimcli/commit/80e3e92888fd619f7aa9fada15cc8b44b5047b62))
* **04-01:** create 8 internal skills with native Claude Code frontmatter ([d081eed](https://github.com/maystudios/maxsimcli/commit/d081eed91ea794e9584d77e0e64a7519d14cada5))
* **04-01:** create always-loaded rules for conventions and verification protocol ([eec12f5](https://github.com/maystudios/maxsimcli/commit/eec12f5142547f77b118de732379e6425086bb92))
* **04-02:** rewrite 5 remaining user-facing skills for new architecture ([1a04f87](https://github.com/maystudios/maxsimcli/commit/1a04f879ee09032d9f0a0fcf8611db34f3f3c8b5))
* **04-02:** rewrite 6 core user-facing skills for new architecture ([90aae27](https://github.com/maystudios/maxsimcli/commit/90aae27cd32da32d6506e7e99e0419f262e45090))
* **04-03:** create 4 generic agent definitions ([80af42e](https://github.com/maystudios/maxsimcli/commit/80af42ec7db474f8469e2ceac97a2674c3adfe3e))
* **04-03:** delete 14 old agents and rewrite AGENTS.md registry ([b42c7f4](https://github.com/maystudios/maxsimcli/commit/b42c7f4babe0af5788bf9c3b5bbd4324823bfc55))
* **04-04:** consolidate CLI agent types from 12 to 4 ([a2e5c46](https://github.com/maystudios/maxsimcli/commit/a2e5c464070b3421570a8580bd75d01a416d4ea0))
* **04-04:** update all workflow files to use 4-agent model names ([2c81d3f](https://github.com/maystudios/maxsimcli/commit/2c81d3f06fa902beb65c24782a4b17308342fec7))
* **05-01:** add worktree types and lifecycle management module ([d81bc25](https://github.com/maystudios/maxsimcli/commit/d81bc25881591172dee07b726882d8a36ef2b926))
* **05-01:** extend config, init context, and CLI with worktree commands ([826e14e](https://github.com/maystudios/maxsimcli/commit/826e14e64eaef46da874c6d9c4cad23afe0242aa))
* **05-02:** add review cycle retry counters and escalation protocol ([595314f](https://github.com/maystudios/maxsimcli/commit/595314f700ec57451df6757497617f32831661e1))
* **05-02:** enhance summary template with review cycle and requirement evidence sections ([a2ae70b](https://github.com/maystudios/maxsimcli/commit/a2ae70ba5ed0eaa614201aed293813d0430cea70))
* **05-03:** add --worktrees/--no-worktrees flag support to execute workflow and command ([d9a13a4](https://github.com/maystudios/maxsimcli/commit/d9a13a4e01d0f9b484108794abdfb9e5661e20b9))
* **05-03:** add decide_execution_mode step and batch worktree path to execute-phase ([9af4015](https://github.com/maystudios/maxsimcli/commit/9af4015e4c48da746e786e0e90a009bcccaa4d10))
* **05-04:** add pre-execution gates G1/G2 and post-execution evidence gate G6 ([fab1d9e](https://github.com/maystudios/maxsimcli/commit/fab1d9ecc7d977fd1ba5a44d63fdbf75e64613a5))
* **05-04:** add requirement validation functions and CLI commands ([38517fe](https://github.com/maystudios/maxsimcli/commit/38517fe938223c8ab7f3f62b0b8edd73b48cbeb8))
* **05-05:** add Agent Teams coordination to execute-phase workflow ([3f1f808](https://github.com/maystudios/maxsimcli/commit/3f1f8084c4dff1e9bbb3e6f1dfdd4b7fa6c4e8ab))
* **05-05:** add worktree-aware executor and Agent Teams installer prompt ([010920e](https://github.com/maystudios/maxsimcli/commit/010920e9abb9cb53c1593d5ec6587a674883a700))
* **hooks:** add sync-reminder hook and update-checker backup logic ([32e0295](https://github.com/maystudios/maxsimcli/commit/32e029504c3f44df70a0d22558979e7e685c4330))
* **hooks:** rewrite statusline with phase/milestone progress, remove context monitor ([48ebea2](https://github.com/maystudios/maxsimcli/commit/48ebea2dcff3cedbe2aab4d9354feccc722b835b))
* **hooks:** update build/install/tests for context monitor removal ([439f424](https://github.com/maystudios/maxsimcli/commit/439f424af3394a7b2fe74a37cbff753a5c2fef24))
* **hooks:** wire sync-reminder into build, installer, and tests ([83cdd6d](https://github.com/maystudios/maxsimcli/commit/83cdd6d36c8cda337050092b257d444d86dd39ce))

# [4.8.0](https://github.com/maystudios/maxsimcli/compare/v4.7.1...v4.8.0) (2026-03-10)


### Features

* **02-01:** add Octokit client adapter, AuthError class, update types ([8872d8a](https://github.com/maystudios/maxsimcli/commit/8872d8afb55c685c4db1795d965b152d8471543d))
* **02-01:** enforce local-only installation, reject --global flag ([2ca49e1](https://github.com/maystudios/maxsimcli/commit/2ca49e12b8e21095283439148c158f6c326910c0))
* **02-02:** rewrite issues.ts with Octokit and native sub-issues ([4897cfe](https://github.com/maystudios/maxsimcli/commit/4897cfe2c1f5ab5bc7731ee2737d7803713ac467)), closes [#legacy](https://github.com/maystudios/maxsimcli/issues/legacy)
* **02-02:** rewrite labels, milestones, mapping to use Octokit ([a8b830d](https://github.com/maystudios/maxsimcli/commit/a8b830d30acea76f028603b78f2e795fd129d80a)), closes [#legacy](https://github.com/maystudios/maxsimcli/issues/legacy)
* **02-03:** rewrite projects.ts with Octokit REST API ([06ebc76](https://github.com/maystudios/maxsimcli/commit/06ebc7609a4d2cf08f5b899226b154de61f5a8b1))
* **02-03:** rewrite sync.ts for GitHub-native state queries ([842a34d](https://github.com/maystudios/maxsimcli/commit/842a34ddab39706921ff98b575098bbc62aa7223))
* **02-04:** wire MCP tools to Octokit adapter, remove legacy patterns ([429d05c](https://github.com/maystudios/maxsimcli/commit/429d05c2c81718fcc9ee5696bf9339948dee4b93))

## [4.7.1](https://github.com/maystudios/maxsimcli/compare/v4.7.0...v4.7.1) (2026-03-09)


### Bug Fixes

* **infra:** remove dashboard package and backend server [INFRA-01, INFRA-02, INFRA-03] ([eb25801](https://github.com/maystudios/maxsimcli/commit/eb25801a251d9b346e0fa3e38d4566efbff1c701))

# [4.7.0](https://github.com/maystudios/maxsimcli/compare/v4.6.0...v4.7.0) (2026-03-09)


### Bug Fixes

* **01-03:** remove unused updateTaskMapping import ([9f5ffbc](https://github.com/maystudios/maxsimcli/commit/9f5ffbc3a872092760dfbd5fc776b59557930b9d))
* **01-06:** disable DTS generation to fix OOM build failure ([00551f7](https://github.com/maystudios/maxsimcli/commit/00551f7a1c74db082f0f16b4aa9c85526e86b412))


### Features

* **01-01:** add gh CLI wrapper with graceful degradation ([4bbec2a](https://github.com/maystudios/maxsimcli/commit/4bbec2af30ea93ab6025989685ba1758282188ec))
* **01-01:** add GitHub integration type definitions ([3a5be34](https://github.com/maystudios/maxsimcli/commit/3a5be34d0a6efa2e7edc8dd0bca8016bcedf08a6))
* **01-01:** add github-issues.json mapping persistence layer ([3b94ddf](https://github.com/maystudios/maxsimcli/commit/3b94ddf8bf2ccc9d7fb977ed7b9c2f612173c9e9))
* **01-02:** add milestone CRUD and issue template installation modules ([c2870a0](https://github.com/maystudios/maxsimcli/commit/c2870a02939f05496b9e50bc82b1b949d0ddf5a0))
* **01-02:** add project board setup and label management modules ([3dba3c4](https://github.com/maystudios/maxsimcli/commit/3dba3c4c593ec0507998bc8d9f4fb53f27bbea4e))
* **01-03:** add issue creation functions and utilities ([27204c8](https://github.com/maystudios/maxsimcli/commit/27204c88cb04c0f21b87fefcb79a8e166c79c79d))
* **01-03:** add lifecycle, import, batch, and supersession functions ([69b450b](https://github.com/maystudios/maxsimcli/commit/69b450b3d2b76b334ec95d1fa303c40e0bf277ca))
* **01-04:** add MCP tools for GitHub issue lifecycle, board queries, and PR creation ([f65c5e5](https://github.com/maystudios/maxsimcli/commit/f65c5e50006134977a1f03d2a85fd7fee531ecb2)), closes [#N](https://github.com/maystudios/maxsimcli/issues/N)
* **01-04:** add sync check module and barrel export for github integration ([fc21755](https://github.com/maystudios/maxsimcli/commit/fc21755eeac43146285d854a0a4cca01e78078b4))
* **01-05:** integrate GitHub operations into phase MCP tools ([218712a](https://github.com/maystudios/maxsimcli/commit/218712a6cd691cf83435600f14c4b302c2b36cde))
* **01-05:** integrate GitHub operations into todo and state MCP tools ([dba2fd3](https://github.com/maystudios/maxsimcli/commit/dba2fd38fd974628d967d5908e0a7179914f438e))

# [4.6.0](https://github.com/maystudios/maxsimcli/compare/v4.5.0...v4.6.0) (2026-03-08)


### Bug Fixes

* **website:** fix codeblock tag text extraction in markdoc schema ([2a465ca](https://github.com/maystudios/maxsimcli/commit/2a465ca1e5d58e0e3b791d296606108d0b0edb9a))
* **website:** resolve TypeScript errors in markdoc components and loader ([d3a7fdd](https://github.com/maystudios/maxsimcli/commit/d3a7fdda5e67f2c7ca846788f6c6cfff931dd2b9))


### Features

* **website:** design refresh for Features and HowItWorks sections ([e39037c](https://github.com/maystudios/maxsimcli/commit/e39037c90d9dac699eb8899c62506ee95c821d5a))
* **website:** migrate docs to Markdoc with content-first architecture ([23a5e9b](https://github.com/maystudios/maxsimcli/commit/23a5e9b60d07b2f80ba981643bf4dd0330f24287))
* **website:** redesign footer with wider brand column, 3 nav sections, and animated gradient divider ([443ed66](https://github.com/maystudios/maxsimcli/commit/443ed662b5651f73917b97371046753c859df600))
* **website:** redesign Hero and Navbar with terminal mockup and refined interactions ([85e7aa2](https://github.com/maystudios/maxsimcli/commit/85e7aa24194192269744ab39bfc96866eb77c5e0))

# [4.5.0](https://github.com/maystudios/maxsimcli/compare/v4.4.0...v4.5.0) (2026-03-07)


### Bug Fixes

* **e2e:** update file count assertions for new commands and agents ([a6fef5d](https://github.com/maystudios/maxsimcli/commit/a6fef5d71a2262faa9f77947e09cd1fb9980ea68))


### Features

* **04-01:** add drift types, frontmatter schema, and core drift module ([94e964b](https://github.com/maystudios/maxsimcli/commit/94e964b9a0280861da47e13ec511be3f6a351356))
* **04-01:** wire drift init commands and CLI dispatch ([2148bd7](https://github.com/maystudios/maxsimcli/commit/2148bd758a5cff6093d058d78dedd6f3761cc4b3))
* **04-02:** create check-drift command and workflow ([1b2f1b3](https://github.com/maystudios/maxsimcli/commit/1b2f1b3f8d6243c2430caf63104ef388bba7b16b))
* **04-02:** create drift-checker agent and register in AGENTS.md ([88171af](https://github.com/maystudios/maxsimcli/commit/88171af03421752ebcca0970e2319a15e8860155))
* **04-03:** add /maxsim:realign command template ([2fbe83c](https://github.com/maystudios/maxsimcli/commit/2fbe83c8a59b4c8e6f0a1e34f15163646dfbfe52))
* **04-03:** add realign workflow with to-code and to-spec directions ([70458fc](https://github.com/maystudios/maxsimcli/commit/70458fc4168461029d86039e9722feb9f11eab65))
* **04:** build dist with drift detection templates and UAT ([567ddcc](https://github.com/maystudios/maxsimcli/commit/567ddcc32d06c1a96b524c986d70dd694e3a346d))
* **05-01:** create /maxsim:discuss command spec ([16db195](https://github.com/maystudios/maxsimcli/commit/16db1953b87a9adc3c1f793e71288132e71b9c21))
* **05-01:** create discuss triage workflow ([bb73a49](https://github.com/maystudios/maxsimcli/commit/bb73a49238f479142974b6b8c78358c562680df3))
* **05-02:** add pagination to MCP mcp_list_phases tool ([9fabd92](https://github.com/maystudios/maxsimcli/commit/9fabd9292a9860914ab592384f240a39f506641f))
* **05-02:** add pagination to roadmap and progress workflows ([0f1c63d](https://github.com/maystudios/maxsimcli/commit/0f1c63d461dd404c938df83daac000829dc521b2))

# [4.4.0](https://github.com/maystudios/maxsimcli/compare/v4.3.1...v4.4.0) (2026-03-07)


### Bug Fixes

* **03-04:** add extractFrontmatter reference to executor review parsing ([f2dbeb2](https://github.com/maystudios/maxsimcli/commit/f2dbeb22fc35517e8cad76e709fee2266bab2140))


### Features

* **03-01:** add coherence sections to executor, planner, plan-checker, phase-researcher ([8d182e6](https://github.com/maystudios/maxsimcli/commit/8d182e6207a303bee7bddab64744264b23d4b70e))
* **03-01:** add coherence sections to project-researcher, research-synthesizer, roadmapper ([e67a691](https://github.com/maystudios/maxsimcli/commit/e67a691b0e479abb4028a2573e22fbcfd7e65304))
* **03-02:** add coherence sections to debugger, mapper, checker + AGENTS.md conventions ([1409a84](https://github.com/maystudios/maxsimcli/commit/1409a842c758a85eeb3b5086ecccc58704a757db))
* **03-02:** add coherence sections to verifier, spec-reviewer, code-reviewer ([b01b37b](https://github.com/maystudios/maxsimcli/commit/b01b37b6b3ae818c47f66ec2fabeb103039cd7c1))
* **03-03:** add agent context interfaces and 5 agent-level init commands ([af3b10f](https://github.com/maystudios/maxsimcli/commit/af3b10f55f9849c5a174d921f29653394aa602a0))
* **03-03:** register agent init commands in CLI router and add review schema ([2060e42](https://github.com/maystudios/maxsimcli/commit/2060e426f52028e474647f31b09f4c296771db8e))
* **03-04:** add review step to quick workflow and update execute-phase review checking ([edff2d1](https://github.com/maystudios/maxsimcli/commit/edff2d17348acb7849ba1896329ea47858610393))
* **03-04:** add universal wave review protocol to executor agent ([fedf8bf](https://github.com/maystudios/maxsimcli/commit/fedf8bf1721a4e170665c276ff1b67e60bf463ec))

## [4.3.1](https://github.com/maystudios/maxsimcli/compare/v4.3.0...v4.3.1) (2026-03-07)


### Bug Fixes

* **install:** skip symlinks in manifest generation to prevent EISDIR crash ([02b113b](https://github.com/maystudios/maxsimcli/commit/02b113bf2301737d9fc658e8e60e3b48013b4624))

# [4.3.0](https://github.com/maystudios/maxsimcli/compare/v4.2.3...v4.3.0) (2026-03-07)


### Bug Fixes

* **test:** update e2e test for renamed simplify -> maxsim-simplify skill ([dc21577](https://github.com/maystudios/maxsimcli/commit/dc2157798ab4f1e29f77fbdc8d14a5e697c6e6e2))


### Features

* **01-01:** implement phase archive sweep with preview/execute and get-archived-phase ([7761f3c](https://github.com/maystudios/maxsimcli/commit/7761f3c00d5d7dc1d674813b1a5a7ab331b09f9c))
* **01-02:** add stale context detection and milestone STATE.md reset ([ed1c460](https://github.com/maystudios/maxsimcli/commit/ed1c460488424c5b0b842c8d097508806e4eb847))
* **02-01:** enhance research agents with actionable output formats ([4310e59](https://github.com/maystudios/maxsimcli/commit/4310e596e9c33734019100497133bb60d65fe7a4))
* **02-01:** rewrite questioning reference with domain checklist and no-gos tracking ([8b85ada](https://github.com/maystudios/maxsimcli/commit/8b85ada91710ef875e79e31dad0740ac4ed309de))
* **02-02:** add Tech Stack Decisions section to PROJECT.md template ([b0acaa5](https://github.com/maystudios/maxsimcli/commit/b0acaa59d624350ead42c33eb8492801a89d6955))
* **02-02:** create CONVENTIONS.md template for agent-ready init output ([e984a1a](https://github.com/maystudios/maxsimcli/commit/e984a1a69a4ffe0b180530f60713f9f8183c5f0b))
* **02-03:** add conventions_path to init context assembly ([50c3d10](https://github.com/maystudios/maxsimcli/commit/50c3d1075f3a0902c232401b25a3ae023c263beb))
* **02-03:** wire deep questioning, conventions, and dry-run into init workflows ([f83a649](https://github.com/maystudios/maxsimcli/commit/f83a6496065b87fd458b082228e5621c42881456))

## [4.2.3](https://github.com/maystudios/maxsimcli/compare/v4.2.2...v4.2.3) (2026-03-03)


### Bug Fixes

* **test:** mock node:fs in adapters test to handle shared.ts side effects ([648176f](https://github.com/maystudios/maxsimcli/commit/648176f411b47d6fe83fada2fb240d83481dd171))

## [4.2.2](https://github.com/maystudios/maxsimcli/compare/v4.2.1...v4.2.2) (2026-03-03)


### Bug Fixes

* **hooks:** restore shebang in pre-push hook ([d03f1cb](https://github.com/maystudios/maxsimcli/commit/d03f1cbfd7001c60884c880d7feb73d85e3ffe05))

## [4.2.1](https://github.com/maystudios/maxsimcli/compare/v4.2.0...v4.2.1) (2026-03-02)


### Bug Fixes

* **dashboard:** execute commands on button click instead of just copying ([ab10ff9](https://github.com/maystudios/maxsimcli/commit/ab10ff9bcb6d74695d52cb1430e5f99485484652))

# [4.2.0](https://github.com/maystudios/maxsimcli/compare/v4.1.0...v4.2.0) (2026-03-02)


### Bug Fixes

* **core:** resolve merge conflicts from parallel async migration PRs ([b8630ba](https://github.com/maystudios/maxsimcli/commit/b8630bae6c79e433abd0eafe7f91b6b5e48fa847))
* **execute-plan:** replace single-executor simplify stage with 3 parallel code reviewers ([d932fc7](https://github.com/maystudios/maxsimcli/commit/d932fc77143e74700aa88d7f776354cac2dde01a))


### Features

* add /maxsim:artefakte command for viewing and managing project artefakte ([b92b09e](https://github.com/maystudios/maxsimcli/commit/b92b09ecf35b6bf4fd489b3b55d873afa62719ab))
* add /maxsim:batch command and workflow for worktree-based parallel execution ([a5f38e8](https://github.com/maystudios/maxsimcli/commit/a5f38e84091a09ef9387db3c99995fbb8740104e))
* add /maxsim:sdd command and workflow for Spec-Driven Dispatch ([038a496](https://github.com/maystudios/maxsimcli/commit/038a496d61fc96bf34e698754881a6137ddacdc3))
* add batch and sdd commands to help reference, complete Phase 6 requirements ([4310461](https://github.com/maystudios/maxsimcli/commit/431046199d7695ee2c42d640921cef71a00645e2))
* **core:** add async versions of internal helpers for Phase 10 performance ([5833d44](https://github.com/maystudios/maxsimcli/commit/5833d44a2e1644fce10a52be535e6c70070d2d64))
* **dashboard:** add in-tab project switching to ProjectSwitcher ([6e037e5](https://github.com/maystudios/maxsimcli/commit/6e037e536969c0171fca1c18bfc141bed60bfcbb))
* **dashboard:** add project switcher for multi-dashboard navigation (DASH-07) ([47d2d00](https://github.com/maystudios/maxsimcli/commit/47d2d002ef4d32f82e56c07890ca7fd4b35fd7f7))
* **dashboard:** add terminal Q&A overlay for answering questions inline (DISC-07) ([07b4040](https://github.com/maystudios/maxsimcli/commit/07b4040525c5c62a04819c7c5ea67cc9d7b7dcdb))
* **discuss:** add phase-scoped artefakte to discuss-phase workflow ([8ce2e4b](https://github.com/maystudios/maxsimcli/commit/8ce2e4bf06bc7aec29df1c4bcb4349b403baacdd))
* expand check-todos brainstorm into thinking-partner discussion ([ebe603d](https://github.com/maystudios/maxsimcli/commit/ebe603d63587f8340cf072f03015c63d648328ed))
* expand thinking-partner reference with context modes and escalation patterns ([f5e7b8e](https://github.com/maystudios/maxsimcli/commit/f5e7b8ee158db4e74b21f50c470851f6c59e5d67))
* implement task-based context loading for planning agents (PS-03) ([457d72b](https://github.com/maystudios/maxsimcli/commit/457d72b002b12df3e482a9b12574bd43fa971865))

# [4.1.0](https://github.com/maystudios/maxsimcli/compare/v4.0.2...v4.1.0) (2026-03-02)


### Features

* **backend:** add unified backend server package ([#49](https://github.com/maystudios/maxsimcli/issues/49)) ([abe4d38](https://github.com/maystudios/maxsimcli/commit/abe4d38decdb45660b6baec19e30c5e77a844fbb))
* **mcp:** add context, roadmap, and config query tools ([#48](https://github.com/maystudios/maxsimcli/issues/48)) ([8828c68](https://github.com/maystudios/maxsimcli/commit/8828c6878354944817c11add6b96481991c088b9))

## [4.0.2](https://github.com/maystudios/maxsimcli/compare/v4.0.1...v4.0.2) (2026-03-02)


### Bug Fixes

* **skills:** rewrite systematic-debugging skill to Anthropic quality standard ([2557563](https://github.com/maystudios/maxsimcli/commit/2557563b750eebbdb527b82b0fe8906abae17cfd))
* **skills:** rewrite verification-before-completion skill to Anthropic quality standard ([9987be6](https://github.com/maystudios/maxsimcli/commit/9987be6845f595fb5ab5ca00cf1a0d5aef513c0e))

## [4.0.1](https://github.com/maystudios/maxsimcli/compare/v4.0.0...v4.0.1) (2026-03-02)


### Bug Fixes

* **mcp:** bundle MCP server dependencies and update README with skills/MCP docs ([7724966](https://github.com/maystudios/maxsimcli/commit/772496696167d8723873b6645826327472824560))

# [4.0.0](https://github.com/maystudios/maxsimcli/compare/v3.12.0...v4.0.0) (2026-03-02)


* feat!: remove non-Claude adapters and simplify install to Claude-only ([e640107](https://github.com/maystudios/maxsimcli/commit/e640107bc7d66fd6b6a22778fc3f5aa2f720f1ae))


### Bug Fixes

* **core:** add actionable context to catch blocks across core modules ([3bda2eb](https://github.com/maystudios/maxsimcli/commit/3bda2eb3767500a2500cd4ce394af90a79ef1c8a))
* **core:** replace Unix find with cross-platform fs walk ([#22](https://github.com/maystudios/maxsimcli/issues/22)) ([8dddae4](https://github.com/maystudios/maxsimcli/commit/8dddae4f2af7fa2c0e398025779c4fcc85389244))
* **core:** replace Unix find with cross-platform fs walk for Windows compatibility ([b121ae6](https://github.com/maystudios/maxsimcli/commit/b121ae68d5d38733960e9ff72c2f7a982f54d739))
* **dashboard:** increase health check timeout to 10s and verify multi-project isolation ([bee185c](https://github.com/maystudios/maxsimcli/commit/bee185c91e730896040afef63eaac5d782cefc28))
* **install:** add .mcp.json backup and install recovery safety ([77eb4fe](https://github.com/maystudios/maxsimcli/commit/77eb4feeafd141eca94349f19615fcee97bb6718))
* **install:** move skills install path from agents/skills/ to skills/ ([436712a](https://github.com/maystudios/maxsimcli/commit/436712a4adee7c86ae9480a6aa93e52ff017338a))
* **install:** remove dead isCodex reference and reject deprecated runtime flags ([#21](https://github.com/maystudios/maxsimcli/issues/21)) ([9a4af80](https://github.com/maystudios/maxsimcli/commit/9a4af80c5543fcd69970fbac4f9c71c9f5821388))
* resolve duplicate CmdResult and update tests for CmdResult pattern ([1e02d4b](https://github.com/maystudios/maxsimcli/commit/1e02d4b7df95d3833fd92f3413870a18ff1be3d4))
* **state:** harden STATE.md parsing for format drift resilience ([9881d1c](https://github.com/maystudios/maxsimcli/commit/9881d1c9f6b1810aa5838f651aa16f9bd87cdf5d))


### Features

* add artefakte system, context loader, and start command (Units 1, 9, 10) ([dbbc2b4](https://github.com/maystudios/maxsimcli/commit/dbbc2b4d35412f9b51e100a9aa2bd027dcd4e398))
* add brainstorming and roadmap-writing skills (Units 7, 8) ([1b8c64c](https://github.com/maystudios/maxsimcli/commit/1b8c64c2c5dec6f2873df1cc79a5002b176f7e96))
* async I/O for hot-path commands and phase-list pagination (Phase 10) ([19e7741](https://github.com/maystudios/maxsimcli/commit/19e7741c8df1567a08f59282235b217855d4cd85))
* **execution:** wire Execute-Review-Simplify-Review cycle into execution pipeline ([7a6a998](https://github.com/maystudios/maxsimcli/commit/7a6a998aeb707288930d99e36c06ba0cac23dfae))
* **mcp:** complete E2E Q&A routing between Claude Code and dashboard ([ac3115a](https://github.com/maystudios/maxsimcli/commit/ac3115a7e120ae9b1e597ae6f9afe664449640a2))
* rewrite workflows with thinking-partner behavior and artefakte integration (Units 2-6) ([f44b4f4](https://github.com/maystudios/maxsimcli/commit/f44b4f4589df9f94fc3b927a88e5683c2b5bbf2d))
* **skills:** add batch-worktree and sdd skill templates ([84997be](https://github.com/maystudios/maxsimcli/commit/84997be21443de3213636f862c480ca32caed254))
* **skills:** add skill-list, skill-install, skill-update CLI commands ([d848acd](https://github.com/maystudios/maxsimcli/commit/d848acd678e19a4eb1bf947e15a972786a801ef0))
* **skills:** register using-maxsim skill for auto-trigger at conversation start ([d5f0a50](https://github.com/maystudios/maxsimcli/commit/d5f0a50ab625655cf1d3e53eebbb86661b011bf3))
* unified dashboard mode with enhanced MCP Q&A and multi-project support (Units 11-14) ([b26205e](https://github.com/maystudios/maxsimcli/commit/b26205ebffb1770daa6f2bbb82ced801af8800eb))


### BREAKING CHANGES

* Remove OpenCode, Gemini, and Codex runtime support.
MAXSIM v2.0 is Claude Code-only.

- Delete adapter files: opencode.ts, gemini.ts, codex.ts
- Delete transforms/: tool-maps.ts, frontmatter.ts, content.ts
- Simplify adapter registry to export only claudeAdapter
- Narrow RuntimeName type to 'claude' literal
- Narrow AdapterConfig.commandStructure to 'nested' only
- Remove --opencode, --gemini, --codex, --both, --all CLI flags
- Remove promptRuntime() multi-runtime selector
- Remove copyFlattenedCommands() and copyCommandsAsCodexSkills()
- Remove configureOpencodePermissions() and parseJsonc()
- Remove non-Claude branches from install, uninstall, hooks, manifest
- Simplify shared.ts to use claudeAdapter directly (no adapter map)
- Update help text and banner for Claude-only messaging

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>

# [3.12.0](https://github.com/maystudios/maxsimcli/compare/v3.11.0...v3.12.0) (2026-03-01)


### Bug Fixes

* **core:** add rethrowCliSignals guard to catch blocks intercepting CliOutput ([1480a1d](https://github.com/maystudios/maxsimcli/commit/1480a1da0d0d38da9db729f0fa67566ff84a62de))
* **install:** add new skills to builtInSkills cleanup list ([f51c1b4](https://github.com/maystudios/maxsimcli/commit/f51c1b44c7e77f414238974c04cc86b8fe5391b3))
* **workflows:** replace Unix find with cross-platform alternatives and remove dashboard auto-launch ([ea8ca60](https://github.com/maystudios/maxsimcli/commit/ea8ca60ff1883a2c835d44d39844317f632d7466))


### Features

* **dashboard:** add Simple Mode panels and connection status banner ([80a6de2](https://github.com/maystudios/maxsimcli/commit/80a6de2aaff4adfa32f99237095c4501696b80a9))
* **skills:** add code-review and simplify skills ([9d54e3a](https://github.com/maystudios/maxsimcli/commit/9d54e3aa5140a6d9b0d647eae488b7e37a919398))
* **skills:** add using-maxsim, memory-management skills and AGENTS.md registry ([60375c9](https://github.com/maystudios/maxsimcli/commit/60375c945eeb3a4e9f05afd5a7a7623409dc313e))
* **workflows:** add explicit Q&A routing bridge directives to high-interaction workflows ([d82e932](https://github.com/maystudios/maxsimcli/commit/d82e93289628f35250a1b00ac202b064071422f2)), closes [hi#interaction](https://github.com/hi/issues/interaction)

# [3.11.0](https://github.com/maystudios/maxsimcli/compare/v3.10.3...v3.11.0) (2026-03-01)


### Bug Fixes

* **build:** increase Node heap size to 8GB for CLI build ([83d0e09](https://github.com/maystudios/maxsimcli/commit/83d0e091591f3edfc9eadc45bc996484bee32f77))
* **core:** deduplicate inline patterns, extract shared CRUD helpers, and fix MCP regex bug ([cb96698](https://github.com/maystudios/maxsimcli/commit/cb96698ab4c0174a520aececa4fd185c5ab52e15))


### Features

* **01-01:** create MCP server entry point with utilities and start-server command ([2fd414b](https://github.com/maystudios/maxsimcli/commit/2fd414b83e85a808de26f52c421a4f38a72790a9))
* **01-01:** implement 5 phase CRUD MCP tools ([366706a](https://github.com/maystudios/maxsimcli/commit/366706a9acfd6de6841afe486c3d222932e157ac))
* **01-02:** implement state management MCP tools ([82ba947](https://github.com/maystudios/maxsimcli/commit/82ba947cba5903221c886ad49464a4cf31cdf10c))
* **01-02:** implement todo CRUD MCP tools ([086d528](https://github.com/maystudios/maxsimcli/commit/086d5285e9e6a59465dbd043400a1bd503ab4d04))
* **01-03:** add MCP fallback guidance to execute-plan workflow ([5d6e40a](https://github.com/maystudios/maxsimcli/commit/5d6e40ae73bd170cc089d35e5c4c2deb9126e504))
* **01-03:** add mcp-server.cjs to install flow and write .mcp.json ([01056b0](https://github.com/maystudios/maxsimcli/commit/01056b095836e2c7b5b5ccb5f746485c7c26ecc7))
* **01-04:** scaffold CONTEXT.md and RESEARCH.md stubs in phase tools ([ac514d8](https://github.com/maystudios/maxsimcli/commit/ac514d8a439bc108b9879d8b05d2df255fc4e920))

## [3.10.3](https://github.com/maystudios/maxsimcli/compare/v3.10.2...v3.10.3) (2026-02-28)


### Bug Fixes

* **dashboard:** add missing useEffect import causing black screen ([693537a](https://github.com/maystudios/maxsimcli/commit/693537a2850f97c8d6e0b45ba19f457cf79301f0))

## [3.10.2](https://github.com/maystudios/maxsimcli/compare/v3.10.1...v3.10.2) (2026-02-28)


### Bug Fixes

* **dashboard:** use \r for PTY and queue command if terminal not ready ([e140d2c](https://github.com/maystudios/maxsimcli/commit/e140d2c2321617083a1191aebeaf78d61f42d98c))

## [3.10.1](https://github.com/maystudios/maxsimcli/compare/v3.10.0...v3.10.1) (2026-02-28)


### Bug Fixes

* **dashboard:** correct New Project command and send newline for execution ([709617b](https://github.com/maystudios/maxsimcli/commit/709617b909ea1a1a101dfde9d654d84bbd6b7d94))

# [3.10.0](https://github.com/maystudios/maxsimcli/compare/v3.9.0...v3.10.0) (2026-02-28)


### Bug Fixes

* bundle MCP SDK subpath imports into dashboard server.js ([e85ba8a](https://github.com/maystudios/maxsimcli/commit/e85ba8a7253635529d5a7892b13290238b50451d))


### Features

* **33-01:** add MCP SDK and create mcp-server.ts with tool registrations ([14ff308](https://github.com/maystudios/maxsimcli/commit/14ff308ba3d52331c9e1466b5baac321bf8857a6))
* **33-01:** wire MCP routes and answer endpoint into server.ts ([0deed2c](https://github.com/maystudios/maxsimcli/commit/0deed2c85856012fd13a5e5f2302f4284d963fdc))
* **33-02:** add StatusBar, pending badge, and MCP server auto-registration ([c0a17ee](https://github.com/maystudios/maxsimcli/commit/c0a17ee57c3c8be705f6789a2a1eb89fec76f1a9))
* **33-02:** wire MCP events to browser UI and replace mock questions ([addcd98](https://github.com/maystudios/maxsimcli/commit/addcd988b0b48ef1b8ba3fa728156f308e91e729))
* **33:** complete Hook Bridge — MCP server, browser integration, and build artifacts ([9ab0732](https://github.com/maystudios/maxsimcli/commit/9ab073282f40be7600fe8e595ce195b45edc48f2))
* add dashboard MCP bridge to all workflow templates ([6a2e0b3](https://github.com/maystudios/maxsimcli/commit/6a2e0b368ef763213bbf3a286b0760e372bcfab9))

# [3.9.0](https://github.com/maystudios/maxsimcli/compare/v3.8.1...v3.9.0) (2026-02-28)


### Bug Fixes

* **32.1-01:** fix useMockQuestions "Ask me more" dead-end bug ([96a0d6f](https://github.com/maystudios/maxsimcli/commit/96a0d6f73f46e9966ba5f14466259fe406d9bbbe))


### Features

* **32-01:** add DiscussionProvider state machine and react-markdown dependency ([31493c9](https://github.com/maystudios/maxsimcli/commit/31493c95d9ce0672b6ee2423a03d410604177d22))
* **32-01:** add QuestionCard, OptionCard, AnsweredCard, SkeletonCard, OptionPreviewPanel ([bf35fa5](https://github.com/maystudios/maxsimcli/commit/bf35fa546202f2df018404ff93d0908324865b61))
* **32-02:** add DiscussionView, DiscussionFooter, ConfirmationDialog, DiscussionCompleteCard ([d7125d5](https://github.com/maystudios/maxsimcli/commit/d7125d5cbeafc1fb2547a186d6844336904b6976))
* **32-02:** wire DiscussionView into SimpleModeView and App.tsx ([4c16771](https://github.com/maystudios/maxsimcli/commit/4c16771eefb2d928210ca9f6475d9602e00e3abf))

## [3.8.1](https://github.com/maystudios/maxsimcli/compare/v3.8.0...v3.8.1) (2026-02-28)


### Bug Fixes

* **dashboard:** wire simple mode to terminal execution + fix visual bugs ([b75987b](https://github.com/maystudios/maxsimcli/commit/b75987b7411af199cec7c168c25991eac17ce483))

# [3.8.0](https://github.com/maystudios/maxsimcli/compare/v3.7.1...v3.8.0) (2026-02-28)


### Features

* **dashboard:** implement Simple Mode UI Shell (phase 31) ([e2460f6](https://github.com/maystudios/maxsimcli/commit/e2460f6de5bc4e1fdc2de0875bb88cd7eea2d09e)), closes [#14b8a6](https://github.com/maystudios/maxsimcli/issues/14b8a6)

## [3.7.1](https://github.com/maystudios/maxsimcli/compare/v3.7.0...v3.7.1) (2026-02-27)


### Bug Fixes

* **30-01:** add skills E2E assertion and align DASH-06 wording ([1cb57aa](https://github.com/maystudios/maxsimcli/commit/1cb57aaffd323871e9af0840308a04c40b1b45f6))
* **30-01:** correct stale Phase 16 narrative counts and Phase 30 scope text ([c1b04f1](https://github.com/maystudios/maxsimcli/commit/c1b04f14f932e3f12f3ae0f8484ccbdd70b71b0b))

# [3.7.0](https://github.com/maystudios/maxsimcli/compare/v3.6.0...v3.7.0) (2026-02-27)


### Features

* **29-01:** add InitExistingContext type and cmdInitExisting function ([983cea0](https://github.com/maystudios/maxsimcli/commit/983cea0a2c17ed4888af097ee63df60e01929a83))
* **29-01:** wire init-existing CLI dispatch and update E2E assertion ([357dcd1](https://github.com/maystudios/maxsimcli/commit/357dcd17db61cd59860e0a5f2772364d9e79945a))
* **29-02:** create init-existing command entry point ([cea9fbd](https://github.com/maystudios/maxsimcli/commit/cea9fbd497e5a19125f32fe322be312249c7b9cc))
* **29-03:** create init-existing workflow with scan-first initialization ([1979d97](https://github.com/maystudios/maxsimcli/commit/1979d97d5f332201597bd07cbceac0e21f48316a))

# [3.6.0](https://github.com/maystudios/maxsimcli/compare/v3.5.3...v3.6.0) (2026-02-27)


### Bug Fixes

* **27-01:** add e2e job to publish.yml and gate release on it ([4afbb97](https://github.com/maystudios/maxsimcli/commit/4afbb97fab53b0a641fc87ea0f2838b986939ddf))
* **27-01:** fix Goal regex and build order for E2E green ([12c379b](https://github.com/maystudios/maxsimcli/commit/12c379bd5b894319e7806d22ca54a88f25164d69))
* **ci:** disable husky hooks during semantic-release push ([5972ffb](https://github.com/maystudios/maxsimcli/commit/5972ffbc95164f36b81f331501bec9bb4b49edc6))


### Features

* **26-01:** create 3 foundational skill files for on-demand agent loading ([2805fe2](https://github.com/maystudios/maxsimcli/commit/2805fe2e15b8f587200a8b6c0e4825f0616e5b26))
* **26-02:** create maxsim-code-reviewer agent prompt ([679a8ed](https://github.com/maystudios/maxsimcli/commit/679a8ed23fbde621c8184182b77fcb1e5101022b))
* **26-02:** create maxsim-spec-reviewer agent prompt ([970df2a](https://github.com/maystudios/maxsimcli/commit/970df2add0c9dadb26bcc3d191a8ad722be71e57))
* **26-03:** enhance executor with anti-rationalization, evidence gate, two-stage review, and skills ([f490731](https://github.com/maystudios/maxsimcli/commit/f49073101364de21972649996b68b196eaeaadf5))
* **26-03:** enhance verifier and debugger with anti-rationalization, evidence gates, and skills ([aa19f23](https://github.com/maystudios/maxsimcli/commit/aa19f23f0ab0a0b4e543fbfbf461eab071672020))
* **26-04:** add anti-rationalization and skills sections to planner agent ([c0c9fcd](https://github.com/maystudios/maxsimcli/commit/c0c9fcd2c50fae09135d0c280d9d13e0d3314d69))
* **26-04:** add anti-rationalization and skills sections to researcher and plan-checker agents ([48c668f](https://github.com/maystudios/maxsimcli/commit/48c668fb2d3bcb93ab60b75eff2ea3df0fcdf709))
* **26-05:** extend install.ts to copy skills directory to .agents/skills/ ([c07ff01](https://github.com/maystudios/maxsimcli/commit/c07ff01b1d8f8eb2d1c585091188028fe1eef09e))

## [3.5.3](https://github.com/maystudios/maxsimcli/compare/v3.5.2...v3.5.3) (2026-02-26)


### Bug Fixes

* **readme:** add dashboard screenshots and publish to npm with updated README ([ba3c7d8](https://github.com/maystudios/maxsimcli/commit/ba3c7d881d3647dac332360b882111ddf03a80f2))

## [3.5.2](https://github.com/maystudios/maxsimcli/compare/v3.5.1...v3.5.2) (2026-02-26)


### Bug Fixes

* **repo:** update all GitHub URLs to new repo name maystudios/maxsimcli ([b260b32](https://github.com/maystudios/maxsimcli/commit/b260b32a1dada6bf85ea0b11588997f45007c8f6))

## [3.5.1](https://github.com/maystudios/maxsim/compare/v3.5.0...v3.5.1) (2026-02-26)


### Bug Fixes

* **readme:** add early alpha notice at top of README ([06a03e2](https://github.com/maystudios/maxsim/commit/06a03e235a73d70896b1c599a970566ff0aa1a97))

# [3.5.0](https://github.com/maystudios/maxsim/compare/v3.4.0...v3.5.0) (2026-02-26)


### Features

* **website:** comprehensive SEO overhaul with meta tags, sitemap, and structured data ([33db639](https://github.com/maystudios/maxsim/commit/33db6392345312f84a2d89a355a64d7d00335612))

# [3.4.0](https://github.com/maystudios/maxsim/compare/v3.3.1...v3.4.0) (2026-02-26)


### Features

* **agents:** add self-improvement loop to MAXSIM agents ([48e12c3](https://github.com/maystudios/maxsim/commit/48e12c36a56013a880ca31524f47250aedcbb4bc))

## [3.3.1](https://github.com/maystudios/maxsim/compare/v3.3.0...v3.3.1) (2026-02-26)


### Bug Fixes

* **dashboard:** add shutdown button, auto-shutdown after 60s with no clients ([92a545a](https://github.com/maystudios/maxsim/commit/92a545a23576954fe485198e53fd756f6b88a7d2))

# [3.3.0](https://github.com/maystudios/maxsim/compare/v3.2.2...v3.3.0) (2026-02-26)


### Features

* **website:** add full /docs documentation page with sidebar navigation ([ca2ed67](https://github.com/maystudios/maxsim/commit/ca2ed674218ed080b40930528c48f3403b4c93bf))

## [3.2.2](https://github.com/maystudios/maxsim/compare/v3.2.1...v3.2.2) (2026-02-26)


### Bug Fixes

* **dashboard:** LAN sharing — always detect local IP, add --network flag, Windows firewall hint ([3cd26a6](https://github.com/maystudios/maxsim/commit/3cd26a6073e11df23c80d9997a08017a24200547))

## [3.2.1](https://github.com/maystudios/maxsim/compare/v3.2.0...v3.2.1) (2026-02-26)


### Bug Fixes

* **dashboard:** mobile-responsive layout with hamburger drawer and adaptive stats ([89d37e6](https://github.com/maystudios/maxsim/commit/89d37e608067ad05fd1022487fbe17b7b2154ccf))

# [3.2.0](https://github.com/maystudios/maxsim/compare/v3.1.6...v3.2.0) (2026-02-26)


### Features

* **dashboard:** Tailscale auto-detection for secure remote access ([f3bb602](https://github.com/maystudios/maxsim/commit/f3bb60259afdec1f4c7ed6df3a18b8ec0131b48b))

## [3.1.6](https://github.com/maystudios/maxsim/compare/v3.1.5...v3.1.6) (2026-02-26)


### Bug Fixes

* **dashboard:** align design language to website — Geist font, accent lines, feature grid ([181888c](https://github.com/maystudios/maxsim/commit/181888c9bc8a32aa60225dcab28feec68915fa43))

## [3.1.5](https://github.com/maystudios/maxsim/compare/v3.1.4...v3.1.5) (2026-02-26)


### Bug Fixes

* **dashboard:** align color scheme to website — blue accent, [#09090](https://github.com/maystudios/maxsim/issues/09090)b bg ([0c2803f](https://github.com/maystudios/maxsim/commit/0c2803fc0de2171171db71c91939e89e9fc11ac5)), closes [#09090b](https://github.com/maystudios/maxsim/issues/09090b) [#09090b](https://github.com/maystudios/maxsim/issues/09090b) [#111111](https://github.com/maystudios/maxsim/issues/111111) [#3b82f6](https://github.com/maystudios/maxsim/issues/3b82f6) [#e63946](https://github.com/maystudios/maxsim/issues/e63946) [#a1a1aa](https://github.com/maystudios/maxsim/issues/a1a1aa) [#777777](https://github.com/maystudios/maxsim/issues/777777) [#27272a](https://github.com/maystudios/maxsim/issues/27272a) [#2a2a2a](https://github.com/maystudios/maxsim/issues/2a2a2a) [#18181b](https://github.com/maystudios/maxsim/issues/18181b) [#161616](https://github.com/maystudios/maxsim/issues/161616)

## [3.1.4](https://github.com/maystudios/maxsim/compare/v3.1.3...v3.1.4) (2026-02-26)


### Bug Fixes

* **dashboard:** Swiss Style redesign — clean, editorial, minimal ([b2ea012](https://github.com/maystudios/maxsim/commit/b2ea012f8b372e6250383acfecf5031d150b344f))

## [3.1.3](https://github.com/maystudios/maxsim/compare/v3.1.2...v3.1.3) (2026-02-26)


### Bug Fixes

* **deps:** replace custom utility code with established npm libraries ([3f3c00a](https://github.com/maystudios/maxsim/commit/3f3c00a041e93a0c092b46f1788ac51233974b3d))

## [3.1.2](https://github.com/maystudios/maxsim/compare/v3.1.1...v3.1.2) (2026-02-26)


### Bug Fixes

* **dashboard:** detect task completion from [x] marker in <done> tags ([80a1803](https://github.com/maystudios/maxsim/commit/80a1803e75efb4825f6f1b17e631358572016eb9))

## [3.1.1](https://github.com/maystudios/maxsim/compare/v3.1.0...v3.1.1) (2026-02-26)


### Bug Fixes

* **dashboard:** move QR button to sidebar, add --network flag, admin elevation for firewall ([dcf6830](https://github.com/maystudios/maxsim/commit/dcf683014e17ee00a960ade1f8633a9fcd8d45ae))

# [3.1.0](https://github.com/maystudios/maxsim/compare/v3.0.3...v3.1.0) (2026-02-26)


### Features

* **dashboard:** local network sharing with QR code and firewall setup ([241722d](https://github.com/maystudios/maxsim/commit/241722d938d6850d78c239064566210011c8d310))

## [3.0.3](https://github.com/maystudios/maxsim/compare/v3.0.2...v3.0.3) (2026-02-26)


### Bug Fixes

* **dashboard:** skip permissions on by default, enter key confirms quick command ([5a59fbf](https://github.com/maystudios/maxsim/commit/5a59fbfd02231f018e30813d28c7444122c3968b))

## [3.0.2](https://github.com/maystudios/maxsim/compare/v3.0.1...v3.0.2) (2026-02-26)


### Bug Fixes

* **ci:** clear NODE_AUTH_TOKEN for npm ci to fix 403 on npm package download ([37fdec7](https://github.com/maystudios/maxsim/commit/37fdec7a161e093224164eee54671d01f5e3ebef))

## [3.0.1](https://github.com/maystudios/maxsim/compare/v3.0.0...v3.0.1) (2026-02-26)


### Bug Fixes

* **dashboard:** fix 4 terminal bugs — input after restart, scroll in split mode, mouse wheel, command execution ([382d69c](https://github.com/maystudios/maxsim/commit/382d69c721e8de4fd5c1b48de6af3e7e80a67752))

# [3.0.0](https://github.com/maystudios/maxsim/compare/v2.5.6...v3.0.0) (2026-02-25)


* refactor!: flatten monorepo — merge core/adapters/hooks/templates/e2e into cli, remove Nx, switch pnpm to npm ([78f37ad](https://github.com/maystudios/maxsim/commit/78f37ada467876fa7f353fefceb85a503642c82a))


### Bug Fixes

* add GSD attribution to README and LICENSE ([44b0b5f](https://github.com/maystudios/maxsim/commit/44b0b5f56f2cec7ea9ff18d4e9abf4517bfa3984))
* **build:** suppress tsdown inlineOnly warning causing CI exit code 1 ([4aaf606](https://github.com/maystudios/maxsim/commit/4aaf606cfc1051e47571b4cad4fcecb2eba90164))
* **ci:** update husky pre-push hook from pnpm to npm ([2882c94](https://github.com/maystudios/maxsim/commit/2882c94498e560b6567020e55bf2dec108fe4fbe))


### BREAKING CHANGES

* Development now requires npm instead of pnpm. No user-facing changes.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>

## [2.5.6](https://github.com/maystudios/maxsim/compare/v2.5.5...v2.5.6) (2026-02-25)


### Bug Fixes

* **dashboard:** spawn claude via system shell for reliable PATH resolution ([0030283](https://github.com/maystudios/maxsim/commit/0030283ac800d966a02290983455ec591557e55e))

## [2.5.5](https://github.com/maystudios/maxsim/compare/v2.5.4...v2.5.5) (2026-02-25)


### Bug Fixes

* **dashboard:** resolve claude executable path on Windows ([18261ea](https://github.com/maystudios/maxsim/commit/18261eafb20dfab82bc4d864d35dcbb550320027))

## [2.5.4](https://github.com/maystudios/maxsim/compare/v2.5.3...v2.5.4) (2026-02-25)


### Bug Fixes

* **dashboard:** cross-platform compatibility fixes ([9101d90](https://github.com/maystudios/maxsim/commit/9101d90de233ea563227d9477721ac1fb1f39115))

## [2.5.3](https://github.com/maystudios/maxsim/compare/v2.5.2...v2.5.3) (2026-02-25)


### Bug Fixes

* **dashboard:** make state section append robust and add server logging ([dd19326](https://github.com/maystudios/maxsim/commit/dd193265ac694c1fe522a4b20da0e55245ca0b73))

## [2.5.2](https://github.com/maystudios/maxsim/compare/v2.5.1...v2.5.2) (2026-02-25)


### Bug Fixes

* **dashboard:** use dedicated endpoints for decisions/blockers and add phase checkbox toggle ([16be0d1](https://github.com/maystudios/maxsim/commit/16be0d12c21e6aa5f39c3c829354e3a65081e4b1))

## [2.5.1](https://github.com/maystudios/maxsim/compare/v2.5.0...v2.5.1) (2026-02-25)


### Bug Fixes

* **dashboard:** auto-install node-pty and preserve it across refreshes ([12c15a8](https://github.com/maystudios/maxsim/commit/12c15a86b53f3cd62d435142b52c161c9dffc21e))

# [2.5.0](https://github.com/maystudios/maxsim/compare/v2.4.2...v2.5.0) (2026-02-25)


### Bug Fixes

* **24-01:** remove isActive from QuickActionBar disabled logic ([53a2f9f](https://github.com/maystudios/maxsim/commit/53a2f9f9e0aee4ee713ce16326bed32d2d9f1a44))
* **25-01:** normalize traceability table statuses to Satisfied ([d177b84](https://github.com/maystudios/maxsim/commit/d177b84c32c37a1302e48517ed020e8dc1626c4a))
* add missing 25-02-SUMMARY.md to fix pre-push doc consistency check in CI ([19870af](https://github.com/maystudios/maxsim/commit/19870af249308bbab0039dd5ee025a9be114d1e6))
* handle padding mismatch in phase insert and fix nx test input ([b032abc](https://github.com/maystudios/maxsim/commit/b032abc48c234e22a9a032b6069fc55cb6b07a01))


### Features

* **22-01:** add frontend unavailable state, error card, and disabled quick actions ([98014ad](https://github.com/maystudios/maxsim/commit/98014ad43be2d3d6404202406702ea2d7fbde9a7))
* **22-01:** add server-side graceful degradation when node-pty absent ([f3c4f55](https://github.com/maystudios/maxsim/commit/f3c4f557af57106614ce20805f7654d47b896a12))
* **23-01:** add dashboard:build to e2e dependsOn ([330a162](https://github.com/maystudios/maxsim/commit/330a1623ef45962adf8959ffff6289d1d7adc800))
* **23-02:** add pre-push doc consistency hook ([d3d5f8e](https://github.com/maystudios/maxsim/commit/d3d5f8eea5811130da42babdacd34e238a1addde))
* **25-01:** backfill requirements_completed into v2.0.0 SUMMARY files ([aa687cd](https://github.com/maystudios/maxsim/commit/aa687cd24fd9c10193db7231f3404240cbe7d63d))
* **25-02:** create pre-push hook with build, lint, docs-check, tests ([b7fead7](https://github.com/maystudios/maxsim/commit/b7fead7f78dea31a189abd529c96965c9ff10459))

## [2.4.2](https://github.com/maystudios/maxsim/compare/v2.4.1...v2.4.2) (2026-02-25)


### Bug Fixes

* **dashboard:** auto-install node-pty before starting dashboard server ([6e576a5](https://github.com/maystudios/maxsim/commit/6e576a583795188749857b92253b78cdb05c3cb7))

## [2.4.1](https://github.com/maystudios/maxsim/compare/v2.4.0...v2.4.1) (2026-02-25)


### Bug Fixes

* **dashboard:** lazy-load node-pty to prevent server crash when unavailable ([7d5b8c2](https://github.com/maystudios/maxsim/commit/7d5b8c20bfcce04082a0df93bfd2cf8d3e83d4c9))

# [2.4.0](https://github.com/maystudios/maxsim/compare/v2.3.0...v2.4.0) (2026-02-25)


### Bug Fixes

* **21:** fix status message parsing and uptime unit mismatch ([83731b8](https://github.com/maystudios/maxsim/commit/83731b861a9e3526243d8761893a7366bd257148))


### Features

* **profiles:** add tokenburner model profile (all opus) ([ecab7e3](https://github.com/maystudios/maxsim/commit/ecab7e3f257da418314a7e87fd5c8f044ddcc4b4))

# [2.3.0](https://github.com/maystudios/maxsim/compare/v2.2.0...v2.3.0) (2026-02-25)


### Features

* **21-03:** integrate terminal into dashboard layout ([a46ca20](https://github.com/maystudios/maxsim/commit/a46ca20dae9c058c2459deb4d228bd1770da5a77))
* **21-04:** create QuickActionBar with confirmation and settings ([6c342ce](https://github.com/maystudios/maxsim/commit/6c342ceed893d57d014669b8715982ae71f21521))
* **21-04:** integrate QuickActionBar into Terminal component ([bed0df1](https://github.com/maystudios/maxsim/commit/bed0df1d7767575389645c9d421ae1a49ab410be))
* **website:** add Dashboard feature card, command, and install path info ([9488b99](https://github.com/maystudios/maxsim/commit/9488b99318d3b83612c721e2d132efa5be56580f))

# [2.2.0](https://github.com/maystudios/maxsim/compare/v2.1.1...v2.2.0) (2026-02-25)


### Bug Fixes

* **website:** replace outdated /gsd: command prefix with /maxsim: and update command count to 31 ([4bda14d](https://github.com/maystudios/maxsim/commit/4bda14dee198a5039d3053c3cfa4e3a7e03a59e4))


### Features

* **21-01:** add PTY manager, session store, and terminal WebSocket endpoint ([a5d9903](https://github.com/maystudios/maxsim/commit/a5d9903b449bd96e8bc95dc693ab45f3a4d35e7e))
* **21-02:** add TerminalStatusBar with process info and controls ([f824f34](https://github.com/maystudios/maxsim/commit/f824f34aa52e5cab04b619ca6571441314b8f705))
* **21-02:** add useTerminal hook and Terminal xterm.js component ([c9c0642](https://github.com/maystudios/maxsim/commit/c9c06428449927f9a41761c5e5dc243a4a7ae723))
* **install:** prompt to enable Agent Teams for Claude during interactive install ([69b25d3](https://github.com/maystudios/maxsim/commit/69b25d3448146a06b17ee4fe2f655962ab4c87fd))

## [2.1.1](https://github.com/maystudios/maxsim/compare/v2.1.0...v2.1.1) (2026-02-25)


### Bug Fixes

* **dashboard:** prevent server shutdown from broken stderr pipe on Windows ([7cbb9f6](https://github.com/maystudios/maxsim/commit/7cbb9f601cd006f72f99d9fba75daf39818e4ec8))

# [2.1.0](https://github.com/maystudios/maxsim/compare/v2.0.5...v2.1.0) (2026-02-25)


### Bug Fixes

* **dashboard:** remove non-existent @types/sirv and update lockfile ([b928c4e](https://github.com/maystudios/maxsim/commit/b928c4ea185260f48783d32229446cfb78c82e0c))
* **dashboard:** rename server.cjs to server.js after tsdown build ([0f9a82f](https://github.com/maystudios/maxsim/commit/0f9a82f6c75317e2fb0ba08adb256fc5b6890e4b))
* **dashboard:** rename tsdown config to .mts to fix ESM parse error in CI ([a0ee56d](https://github.com/maystudios/maxsim/commit/a0ee56d80d81542c8337f51aa08d147587cf2af7))


### Features

* **dashboard:** migrate from Next.js standalone to Vite + Express ([c1f8b0d](https://github.com/maystudios/maxsim/commit/c1f8b0d39e9d4656ae06257be1cddcc3a68aed80))

## [2.0.5](https://github.com/maystudios/maxsim/compare/v2.0.4...v2.0.5) (2026-02-25)


### Bug Fixes

* **dashboard:** copy static assets to packages/dashboard/.next/static/ ([59aa764](https://github.com/maystudios/maxsim/commit/59aa7640aa8a0f1eafc02c55989dc2a11bfb5c49))

## [2.0.4](https://github.com/maystudios/maxsim/compare/v2.0.3...v2.0.4) (2026-02-25)


### Bug Fixes

* **dashboard:** hoist styled-jsx from pnpm store at install time ([fd6654d](https://github.com/maystudios/maxsim/commit/fd6654d9fa111055cb18fec6482c2d4b4205c187))

## [2.0.3](https://github.com/maystudios/maxsim/compare/v2.0.2...v2.0.3) (2026-02-25)


### Bug Fixes

* **dashboard:** copy required-server-files.json into standalone bundle and clean stale installs ([2f1e938](https://github.com/maystudios/maxsim/commit/2f1e9389d933083b35719e2f8af343971a059346))

## [2.0.2](https://github.com/maystudios/maxsim/compare/v2.0.1...v2.0.2) (2026-02-25)


### Bug Fixes

* **dashboard:** fix dashboard launch on Windows paths with spaces and slow cold-starts ([a811921](https://github.com/maystudios/maxsim/commit/a811921f9db63d398472339d12e6056d5c457c29))

## [2.0.1](https://github.com/maystudios/maxsim/compare/v2.0.0...v2.0.1) (2026-02-25)


### Bug Fixes

* **ci:** remove custom GIT_COMMITTER env vars that break semantic-release GitHub plugin ([ad5a5a6](https://github.com/maystudios/maxsim/commit/ad5a5a6bffa473f633f7719cf2d48635bb28401b))

# [2.0.0](https://github.com/maystudios/maxsim/compare/v1.3.0...v2.0.0) (2026-02-25)


* feat!: release v2.0.0 — E2E-validated npm delivery with live dashboard ([13fa7a4](https://github.com/maystudios/maxsim/commit/13fa7a479e3e75d20e30b46406d42684f0bee7eb))


### Bug Fixes

* **ci:** call semantic-release binary directly to avoid pnpm recursive exec ([bdf4108](https://github.com/maystudios/maxsim/commit/bdf41089d16b41cfe8ed591fa092916437391052))
* **ci:** set NODE_AUTH_TOKEN so setup-node npmrc auth works with semantic-release ([bc30224](https://github.com/maystudios/maxsim/commit/bc302246bf31f295bb457ba39664c9b0b2ed10e1))
* **ci:** use pnpm exec semantic-release to resolve local plugins ([bd62749](https://github.com/maystudios/maxsim/commit/bd6274991b35e156ca4b4551732b813f0f2f979b))
* **e2e:** add title frontmatter and 02-integration dir to mock fixture ([2563892](https://github.com/maystudios/maxsim/commit/2563892b3a9931bd1c98c5f7c4491a0182e9c822))


### Features

* **ci:** add E2E gate to publish workflow — failing tests block release ([c2dd048](https://github.com/maystudios/maxsim/commit/c2dd048dc6d737fb23e0ba652537a2d3196bae8b))
* **e2e:** add dashboard.test.ts with 5 read API endpoint assertions ([f3df880](https://github.com/maystudios/maxsim/commit/f3df8803e2c2e123b781a25ecde7b9fbba57ae80))


### BREAKING CHANGES

* Minimum Node.js version raised to >=22.0.0. Complete
rewrite from CJS monolith to pnpm workspace with TypeScript packages.
Dashboard now ships inside the npm tarball as a Next.js standalone build.
E2E test suite validates the full install lifecycle from npm consumer
perspective. CI gate blocks publish when E2E fails.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## 1.3.0 (2026-02-24)

### 🚀 Features

- **cli:** add --version flag to install binary ([8fa087d](https://github.com/maystudios/maxsim/commit/8fa087d))
- **e2e:** add packages/e2e NX scaffold with vitest passWithNoTests ([917aa86](https://github.com/maystudios/maxsim/commit/917aa86))
- **e2e:** wire globalSetup in vitest.config.ts and add ProvidedContext types ([0e1e6ce](https://github.com/maystudios/maxsim/commit/0e1e6ce))
- **e2e:** add globalSetup pack+install pipeline and mock project fixture ([473a494](https://github.com/maystudios/maxsim/commit/473a494))
- **e2e:** add install.test.ts and tools.test.ts E2E assertion layer ([c41c616](https://github.com/maystudios/maxsim/commit/c41c616))

### ❤️ Thank You

- Claude Sonnet 4.6
- Sven

## 1.2.3 (2026-02-24)

### 🩹 Fixes

- **dashboard:** resolve standalone server startup failures ([10c3c31](https://github.com/maystudios/maxsim/commit/10c3c31))

### ❤️ Thank You

- Claude Sonnet 4.6
- Sven

## 1.2.2 (2026-02-24)

### 🩹 Fixes

- **dashboard:** use CJS format for standalone server bundle ([29f2773](https://github.com/maystudios/maxsim/commit/29f2773))

### ❤️ Thank You

- Claude Sonnet 4.6
- Sven

## 1.2.1 (2026-02-24)

### 🚀 Features

- **14-01:** configure Next.js standalone output with env-var guard and server bundling ([7fa5de8](https://github.com/maystudios/maxsim/commit/7fa5de8))
- **14-01:** add build:standalone script and update NX build target ([1e573de](https://github.com/maystudios/maxsim/commit/1e573de))
- **14-02:** extend copy-assets.cjs for dashboard and add NX implicit dependency ([7352c8c](https://github.com/maystudios/maxsim/commit/7352c8c))
- **14-02:** add dashboard install-time copy and rework CLI launch command ([1199bf2](https://github.com/maystudios/maxsim/commit/1199bf2))

### 🩹 Fixes

- **cli:** use fs.cpSync with dereference for dashboard standalone copy ([472e123](https://github.com/maystudios/maxsim/commit/472e123))
- **dashboard:** handle tsdown exit code 1 despite successful build ([b92cade](https://github.com/maystudios/maxsim/commit/b92cade))

### ❤️ Thank You

- Claude Sonnet 4.6
- Sven

## 1.2.0 (2026-02-24)

### 🚀 Features

- **cli:** add `npx maxsimcli dashboard` command with monorepo detection ([b328544](https://github.com/maystudios/maxsim/commit/b328544))

### ❤️ Thank You

- Claude Opus 4.6
- Sven

## 1.1.3 (2026-02-24)

### 🚀 Features

- **13-02:** create custom server with WebSocket and file watcher modules ([2ffbf0b](https://github.com/maystudios/maxsim/commit/2ffbf0b))
- **13-02:** create WebSocket React provider with auto-reconnect ([2d3f058](https://github.com/maystudios/maxsim/commit/2d3f058))
- **13-03:** create lib/parsers.ts with @maxsim/core wrapper functions ([896e71e](https://github.com/maystudios/maxsim/commit/896e71e))
- **13-03:** create read-only API route handlers ([8f7ea3b](https://github.com/maystudios/maxsim/commit/8f7ea3b))
- **13-03:** create write/mutation API route handlers ([6679731](https://github.com/maystudios/maxsim/commit/6679731))
- **13-04:** create useDashboardData hook and StatsHeader component ([af3c50e](https://github.com/maystudios/maxsim/commit/af3c50e))
- **13-04:** create phase list, phase progress, and wire main dashboard page ([d37d7e4](https://github.com/maystudios/maxsim/commit/d37d7e4))
- **13-05:** add usePhaseDetail hook, plan card, and task list components ([c232dfd](https://github.com/maystudios/maxsim/commit/c232dfd))
- **13-05:** add CodeMirror plan editor and phase detail container ([ce2d495](https://github.com/maystudios/maxsim/commit/ce2d495))
- **13-06:** add sidebar navigation and app shell layout ([5020c73](https://github.com/maystudios/maxsim/commit/5020c73))
- **13-06:** add todos panel, blockers panel, and state editor ([6be1847](https://github.com/maystudios/maxsim/commit/6be1847))
- **13-07:** add dashboard launch command to CLI dispatch router ([a593fc4](https://github.com/maystudios/maxsim/commit/a593fc4))
- **13-07:** update dashboard build pipeline with server compilation ([e4dadd2](https://github.com/maystudios/maxsim/commit/e4dadd2))
- **13-07:** create health check API endpoint for dashboard ([99aff72](https://github.com/maystudios/maxsim/commit/99aff72))
- **13-07:** add dashboard auto-launch to execute-phase workflow ([e639b0b](https://github.com/maystudios/maxsim/commit/e639b0b))

### ❤️ Thank You

- Claude Opus 4.6
- Sven

## 1.1.2 (2026-02-24)

### 🚀 Features

- **13-01:** scaffold packages/dashboard NX package with Next.js 15 and dependencies ([8cb33d6](https://github.com/maystudios/maxsim/commit/8cb33d6))
- **13-01:** add dark theme layout, globals, utilities, types, and Aceternity config ([c8f76cb](https://github.com/maystudios/maxsim/commit/c8f76cb))

### ❤️ Thank You

- Claude Opus 4.6
- Sven

## 1.1.1 (2026-02-24)

### 🩹 Fixes

- **discuss:** enforce AskUserQuestion tool for all user interactions ([149fda4](https://github.com/maystudios/maxsim/commit/149fda4))

### ❤️ Thank You

- Claude Opus 4.6
- Sven

## 1.1.0 (2026-02-24)

### 🚀 Features

- **cli:** use figlet ANSI Shadow for banner instead of hardcoded Unicode escapes ([3952531](https://github.com/maystudios/maxsim/commit/3952531))

### 🩹 Fixes

- **ci:** remove figlet from root package.json, keep only in packages/cli ([e99c16d](https://github.com/maystudios/maxsim/commit/e99c16d))

### ❤️ Thank You

- Claude Sonnet 4.6
- Sven

## 1.0.12 (2026-02-24)

### 🩹 Fixes

- **core:** integration validation cleanup — build, catch blocks, regex ([7762847](https://github.com/maystudios/maxsim/commit/7762847))

### ❤️ Thank You

- Sven

## 1.0.11 (2026-02-24)

### 🚀 Features

- **core:** add chalk dependency and phase-bars format to cmdProgressRender ([121f17c](https://github.com/maystudios/maxsim/commit/121f17c))
- **templates:** add /maxsim:roadmap command and workflow ([372c8a3](https://github.com/maystudios/maxsim/commit/372c8a3))
- **templates:** update progress workflow to use phase-bars format ([c9672ee](https://github.com/maystudios/maxsim/commit/c9672ee))
- **templates:** add sanity_check guard to five major workflow files ([fca2b19](https://github.com/maystudios/maxsim/commit/fca2b19))

### ❤️ Thank You

- Sven

## 1.0.10 (2026-02-24)

This was a version bump only, there were no code changes.

## 1.0.1 (2026-02-24)

This was a version bump only, there were no code changes.

# 2.0.0 (2026-02-24)

### 🚀 Features

- ⚠️  initial release as maxsimcli v1.0.0 ([fa648cf](https://github.com/maystudios/maxsim/commit/fa648cf))

### ⚠️  Breaking Changes

- initial release as maxsimcli v1.0.0  ([fa648cf](https://github.com/maystudios/maxsim/commit/fa648cf))
  Package renamed from maxsim to maxsimcli.
  Install via: npx maxsimcli@latest
  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

### ❤️ Thank You

- Claude Sonnet 4.6
- Sven

## 1.21.2 (2026-02-24)

### 🩹 Fixes

- replace GSD ASCII banner with MAXSIM banner ([24aedb7](https://github.com/maystudios/maxsim/commit/24aedb7))

### ❤️ Thank You

- Claude Sonnet 4.6
- Sven

## 1.21.1 (2026-02-24)

### 🩹 Fixes

- use dynamic package name for tarball path in publish workflow ([ba7fded](https://github.com/maystudios/maxsim/commit/ba7fded))
- update remaining maxsim references to maxsimcli ([d1ced1c](https://github.com/maystudios/maxsim/commit/d1ced1c))

### ❤️ Thank You

- Claude Sonnet 4.6
- Sven

## 1.21.0 (2026-02-24)

### 🚀 Features

- rename npm package from maxsim to maxsimcli ([7a626a7](https://github.com/maystudios/maxsim/commit/7a626a7))

### 🩹 Fixes

- copy workspace packages into node_modules for bundledDependencies ([5db9e10](https://github.com/maystudios/maxsim/commit/5db9e10))
- use pnpm pack + npm publish for correct workspace bundling ([6bfb574](https://github.com/maystudios/maxsim/commit/6bfb574))
- use hoisted nodeLinker for pnpm pack with bundledDependencies ([3d63115](https://github.com/maystudios/maxsim/commit/3d63115))

### ❤️ Thank You

- Claude Sonnet 4.6
- Sven

## 1.20.8 (2026-02-24)

### 🩹 Fixes

- specify packageManager for pnpm action-setup ([8d0daf2](https://github.com/maystudios/maxsim/commit/8d0daf2))
- remove conflicting --yes flag from nx release ([98b1320](https://github.com/maystudios/maxsim/commit/98b1320))
- handle first release when no git tags exist ([5d8be00](https://github.com/maystudios/maxsim/commit/5d8be00))
- use pnpm publish directly from packages/cli ([effc9dc](https://github.com/maystudios/maxsim/commit/effc9dc))
- use pnpm pack + npm publish to avoid bundledDependencies linker error ([cb31036](https://github.com/maystudios/maxsim/commit/cb31036))
- use npm publish instead of pnpm to avoid bundledDependencies linker error ([c2c9215](https://github.com/maystudios/maxsim/commit/c2c9215))
- skip publish when no version bump detected ([008ab0e](https://github.com/maystudios/maxsim/commit/008ab0e))
- compare versions before publishing to avoid 403 errors ([f56cdb3](https://github.com/maystudios/maxsim/commit/f56cdb3))
- resolve pnpm symlinks before publish and bump to 1.20.7 ([c9962dd](https://github.com/maystudios/maxsim/commit/c9962dd))

### ❤️ Thank You

- Claude Sonnet 4.6
- Sven
