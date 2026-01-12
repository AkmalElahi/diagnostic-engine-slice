import { FlowValidator, FlowValidationError } from '../utils/flowValidator';

interface InvalidFlowTest {
  name: string;
  description: string;
  flow: any;
  expectedError: string;
}

/**
 * DEMONSTRATION: Flow Validation Proof for Client
 */
export function demonstrateValidation() {
  console.log('═══════════════════════════════════════════════');
  console.log('     FLOW VALIDATION PROOF DEMONSTRATION');
  console.log('═══════════════════════════════════════════════\n');

  const invalidFlows: InvalidFlowTest[] = [
    // ========================================
    // Example 1: Missing Start Node
    // ========================================
    {
      name: 'INVALID FLOW #1',
      description: 'Missing start_node field',
      flow: {
        flow_id: 'broken_flow_1',
        flow_version: '1.0',
        // start_node is missing
        nodes: {
          q1: {
            type: 'QUESTION',
            text: 'Is power on?',
            yes: 't1',
            no: 't1',
          },
          t1: {
            type: 'TERMINAL',
            result: 'Complete',
          },
        },
      },
      expectedError: `start_node does not exist in nodes`,
    },

    // ========================================
    // Example 2: Broken Reference
    // ========================================
    {
      name: 'INVALID FLOW #2',
      description: 'Question node references non-existent node',
      flow: {
        flow_id: 'broken_flow_2',
        flow_version: '1.0',
        start_node: 'q1',
        nodes: {
          q1: {
            type: 'QUESTION',
            text: 'Is RV connected to shore power?',
            yes: 's1',
            no: 'missing_node', // This node doesn't exist
          },
          s1: {
            type: 'SAFETY',
            text: 'Disconnect power',
            next: 't1',
          },
          t1: {
            type: 'TERMINAL',
            result: 'Done',
          },
        },
      },
      expectedError:
        'QUESTION node "q1" no branch "missing_node" does not exist',
    },

    // ========================================
    // Example 3: Invalid MEASURE Range
    // ========================================
    {
      name: 'INVALID FLOW #3',
      description: 'MEASURE node with min >= max',
      flow: {
        flow_id: 'broken_flow_3',
        flow_version: '1.0',
        start_node: 'm1',
        nodes: {
          m1: {
            type: 'MEASURE',
            text: 'Measure battery voltage',
            min: 14, // min is greater than max
            max: 10,
            branches: {
              below: 't1',
              within: 't2',
            },
          },
          t1: {
            type: 'TERMINAL',
            result: 'Low voltage',
          },
          t2: {
            type: 'TERMINAL',
            result: 'Normal voltage',
          },
        },
      },
      expectedError: 'MEASURE node "m1" min must be less than max',
    },

    // ========================================
    // Example 4: Missing Required Field
    // ========================================
    {
      name: 'INVALID FLOW #4',
      description: 'QUESTION node missing text field',
      flow: {
        flow_id: 'broken_flow_4',
        flow_version: '1.0',
        start_node: 'q1',
        nodes: {
          q1: {
            type: 'QUESTION',
            // text field is missing
            yes: 't1',
            no: 't1',
          },
          t1: {
            type: 'TERMINAL',
            result: 'Done',
          },
        },
      },
      expectedError: 'QUESTION node "q1" must have text',
    },

    // ========================================
    // Example 5: Missing TERMINAL Node
    // ========================================
    {
      name: 'INVALID FLOW #5',
      description: 'Flow with no TERMINAL nodes (infinite loop)',
      flow: {
        flow_id: 'broken_flow_5',
        flow_version: '1.0',
        start_node: 'q1',
        nodes: {
          q1: {
            type: 'QUESTION',
            text: 'Continue?',
            yes: 's1',
            no: 's1',
          },
          s1: {
            type: 'SAFETY',
            text: 'Be careful',
            next: 'q1', // Loops back, no way to exit
          },
          // No TERMINAL node exists
        },
      },
      expectedError: 'Flow must have at least one TERMINAL node',
    },

    // ========================================
    // Example 6: Missing Branch
    // ========================================
    {
      name: 'INVALID FLOW #7',
      description: 'MEASURE node missing branches.within',
      flow: {
        flow_id: 'broken_flow_7',
        flow_version: '1.0',
        start_node: 'm1',
        nodes: {
          m1: {
            type: 'MEASURE',
            text: 'Measure voltage',
            min: 10,
            max: 14,
            branches: {
              below: 't1',
              // within is missing
            },
          },
          t1: {
            type: 'TERMINAL',
            result: 'Done',
          },
        },
      },
      expectedError: 'MEASURE node "m1" must have branches.within',
    },
  ];

  let passCount = 0;
  let failCount = 0;

  invalidFlows.forEach((test, index) => {
    console.log(`\n${'─'.repeat(47)}`);
    console.log(`${test.name}: ${test.description}`);
    console.log(`${'─'.repeat(47)}`);

    console.log('\n📄 Invalid Flow JSON:');
    console.log(JSON.stringify(test.flow, null, 2));

    console.log('\n🔍 Running Validation...\n');

    try {
      FlowValidator.validate(test.flow);

      // If we get here, validation didn't throw an error (BAD)
      console.log('VALIDATION FAILED TO CATCH ERROR');
      console.log(`Expected error: "${test.expectedError}"`);
      console.log('But validation passed (should have failed)\n');
      failCount++;
    } catch (error) {
      if (error instanceof FlowValidationError) {
        const errorMessage = error.message;
        const errorMatches = errorMessage.includes(test.expectedError);

        console.log('⚠️  FlowValidationError thrown:');
        console.log(`   "${errorMessage}"`);
        console.log('FAILED');
        console.log(`Expected error substring: "${test.expectedError}"`);
        console.log(`Match: ${errorMatches ? 'YES' : 'NO'}`);

        if (errorMatches) {
          console.log('\nTEST PASSED: Correct validation error caught\n');
          passCount++;
        } else {
          console.log('\nTEST FAILED: Wrong error message\n');
          failCount++;
        }
      } else {
        console.log('UNEXPECTED ERROR TYPE');
        console.log(`   Got: ${error}`);
        console.log(`   Expected: FlowValidationError\n`);
        failCount++;
      }
    }
  });

  // ===== SUMMARY =====
  console.log('\n═══════════════════════════════════════════════');
  console.log('📊 VALIDATION TEST SUMMARY');
  console.log('═══════════════════════════════════════════════\n');

  console.log(`Total Tests: ${invalidFlows.length}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}\n`);

  if (failCount === 0) {
    console.log('🎉 ALL VALIDATION TESTS PASSED');
    console.log('\n✓ All invalid flows were correctly rejected');
    console.log('✓ All error messages were accurate');
    console.log('✓ Flow validator is working correctly\n');
  } else {
    console.log('⚠️  SOME TESTS FAILED\n');
  }

  console.log('═══════════════════════════════════════════════\n');

  return failCount === 0;
}
