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
import * as iam from '@aws-cdk/aws-iam';
import * as s3 from '@aws-cdk/aws-s3';
import * as kinesis from '@aws-cdk/aws-kinesis';
import * as firehose from '@aws-cdk/aws-kinesisfirehose';

import { EncryptedBucket } from './s3-bucket';

export interface DeliveryStreamProps {
    readonly inputDataStream: kinesis.Stream;
    readonly bufferingInterval: number;
    readonly bufferingSize: number;
    readonly compressionFormat: string;

    readonly dataPrefix: string;
    readonly errorsPrefix: string;

    readonly dynamicPartitioning: string;
    readonly newLineDelimiter: string;
    readonly jqExpression?: string;
    readonly retryDuration?: number;
}

export enum FeatureStatus {
    ENABLED = 'Enabled',
    DISABLED = 'Disabled'
}

export enum CompressionFormat {
    GZIP = 'GZIP',
    HADOOP_SNAPPY = 'HADOOP_SNAPPY',
    SNAPPY = 'Snappy',
    UNCOMPRESSED = 'UNCOMPRESSED',
    ZIP = 'ZIP'
}

export class DeliveryStream extends cdk.Construct {
    private readonly Output: EncryptedBucket;
    public readonly deliveryStreamArn: string;
    public readonly deliveryStreamName: string;

    public get outputBucket(): s3.IBucket {
        return this.Output.bucket;
    }

    constructor(scope: cdk.Construct, id: string, props: DeliveryStreamProps) {
        super(scope, id);

        const firehoseRole = new iam.Role(this, 'Role', {
            assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com'),
            inlinePolicies: {
                ReadSource: new iam.PolicyDocument({
                    statements: [new iam.PolicyStatement({
                        resources: [props.inputDataStream.streamArn],
                        actions: [
                            'kinesis:DescribeStream',
                            'kinesis:DescribeStreamSummary',
                            'kinesis:GetShardIterator',
                            'kinesis:GetRecords',
                            'kinesis:ListShards',
                            'kinesis:SubscribeToShard'
                        ]
                    })]
                })
            }
        });

        this.Output = new EncryptedBucket(this, 'Output', {
            enableIntelligentTiering: true
        });

        this.outputBucket.grantWrite(firehoseRole);

        const dpEnabledCondition = new cdk.CfnCondition(this, 'DynamicPartitioningEnabled', {
            expression: cdk.Fn.conditionEquals(props.dynamicPartitioning, FeatureStatus.ENABLED)
        });

        const dpDisabledCondition = new cdk.CfnCondition(this, 'DynamicPartitioningDisabled', {
            expression: cdk.Fn.conditionEquals(props.dynamicPartitioning, FeatureStatus.DISABLED)
        });

        const newLineCondition = new cdk.CfnCondition(this, 'NewLineDelimiter', {
            expression: cdk.Fn.conditionEquals(props.newLineDelimiter, FeatureStatus.ENABLED)
        });

        const commonFirehoseProps = {
            deliveryStreamType: 'KinesisStreamAsSource',
            kinesisStreamSourceConfiguration: {
                kinesisStreamArn: props.inputDataStream.streamArn,
                roleArn: firehoseRole.roleArn
            }
        };

        const commonDestinationProps = {
            bucketArn: this.outputBucket.bucketArn,
            roleArn: firehoseRole.roleArn,
            bufferingHints: {
                intervalInSeconds: props.bufferingInterval,
                sizeInMBs: props.bufferingSize
            },
            compressionFormat: props.compressionFormat,
            prefix: props.dataPrefix,
            errorOutputPrefix: props.errorsPrefix
        }

        const kdfWithoutDP = new firehose.CfnDeliveryStream(this, 'DeliveryStreamWithoutDP', {
            ...commonFirehoseProps,
            extendedS3DestinationConfiguration: {
                ...commonDestinationProps
            }
        });

        const kdfWithDp = new firehose.CfnDeliveryStream(this, 'DeliveryStreamWithDP', {
            ...commonFirehoseProps,
            extendedS3DestinationConfiguration: {
                ...commonDestinationProps,
                dynamicPartitioningConfiguration: {
                    enabled: true,
                    retryOptions: {
                        durationInSeconds: props.retryDuration
                    }
                },
                processingConfiguration: {
                    enabled: true,
                    processors: [
                        {
                            type: 'MetadataExtraction',
                            parameters: [
                                {
                                    parameterName: 'MetadataExtractionQuery',
                                    parameterValue: props.jqExpression!
                                },
                                {
                                    parameterName: 'JsonParsingEngine',
                                    parameterValue: 'JQ-1.6'
                                }
                            ]
                        },
                        {
                            type: 'AppendDelimiterToRecord',
                            parameters: [{
                                parameterName: 'Delimiter',
                                parameterValue: cdk.Fn.conditionIf(newLineCondition.logicalId, '\\n', '').toString()
                            }]
                        }
                        // Other processors can be added here as well.
                        // For instance, if multi record deaggregation needs to be enabled, you can umcomment the following code:
                        /*
                        {
                            type: 'RecordDeAggregation',
                            parameters: [{
                                parameterName: 'SubRecordType',
                                parameterValue: 'JSON'
                            }]
                        }
                        */
                    ]
                }
            }
        });

        kdfWithoutDP.cfnOptions.condition = dpDisabledCondition;
        kdfWithDp.cfnOptions.condition = dpEnabledCondition;

        this.deliveryStreamArn = cdk.Fn.conditionIf(
            dpEnabledCondition.logicalId,
            kdfWithDp.getAtt('Arn'),
            kdfWithoutDP.getAtt('Arn')
        ).toString();

        this.deliveryStreamName = cdk.Fn.conditionIf(
            dpEnabledCondition.logicalId,
            kdfWithDp.ref,
            kdfWithoutDP.ref
        ).toString();
    }
}
