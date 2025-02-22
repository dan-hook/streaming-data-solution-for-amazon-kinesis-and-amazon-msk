/*********************************************************************************************************************
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                                                *
 *                                                                                                                    *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/LICENSE-2.0                                                                    *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/

import * as cdk from '@aws-cdk/core';
import * as kinesis from '@aws-cdk/aws-kinesis';
import { SynthUtils } from '@aws-cdk/assert';

import { DeliveryStream, CompressionFormat, FeatureStatus } from '../lib/kdf-delivery-stream';

test('creates a KDF delivery stream', () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');
    const testStream = new kinesis.Stream(stack, 'TestStream');

    const kdf = new DeliveryStream(stack, 'TestDeliveryStream', {
        inputDataStream: testStream,
        bufferingInterval: 60,
        bufferingSize: 1,
        compressionFormat: CompressionFormat.GZIP,
        dataPrefix: 'data/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/hour=!{timestamp:HH}/',
        errorsPrefix: 'errors/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/hour=!{timestamp:HH}/!{firehose:error-output-type}',
        dynamicPartitioning: FeatureStatus.ENABLED,
        newLineDelimiter: FeatureStatus.DISABLED,
        jqExpression: '{ foo: .bar }',
        retryDuration: 300
    });

    expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
    expect(kdf.deliveryStreamArn).not.toBeUndefined();
    expect(kdf.deliveryStreamName).not.toBeUndefined();
    expect(kdf.outputBucket).not.toBeUndefined();
});
