﻿/*
* Slickflow 工作流引擎遵循LGPL协议，也可联系作者商业授权并获取技术支持；
* 除此之外的使用则视为不正当使用，请您务必避免由此带来的商业版权纠纷。
* 
The Slickflow project.
Copyright (C) 2014  .NET Workflow Engine Library

This library is free software; you can redistribute it and/or
modify it under the terms of the GNU Lesser General Public
License as published by the Free Software Foundation; either
version 2.1 of the License, or (at your option) any later version.

This library is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public
License along with this library; if not, you can access the official
web page about lgpl: https://www.gnu.org/licenses/lgpl.html
*/

using System;
using System.Threading;
using System.Data.Linq;
using System.Transactions;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Slickflow.Engine.Common;
using Slickflow.Engine.Utility;
using Slickflow.Data;
using Slickflow.Engine.Core.Result;
using Slickflow.Engine.Business.Entity;
using Slickflow.Engine.Business.Manager;
using Slickflow.Engine.Xpdl;
using Slickflow.Engine.Core.Event;
using Slickflow.Engine.Core.Pattern;

namespace Slickflow.Engine.Core
{
    /// <summary>
    /// 退回流程运行时
    /// </summary>
    internal class WfRuntimeManagerSendBack : WfRuntimeManager
    {
        /// <summary>
        /// 退回操作的处理逻辑
        /// </summary>
        /// <param name="session"></param>
        internal override void ExecuteInstanceImp(IDbSession session)
        {
            var nodeMediatorBackward = new NodeMediatorBackward(base.BackwardContext, session);
            var aim = new ActivityInstanceManager();
            var backMostPreviouslyActivityInstanceID = GetBackwardMostPreviouslyActivityInstanceID();
            var previousActvityInstance = aim.GetById(backMostPreviouslyActivityInstanceID);

            if (previousActvityInstance.MIHostActivityInstanceID != null)
            {
                //上一步节点是会签节点的退回处理
                var mainPrevousActivityInstance = aim.GetById(previousActvityInstance.MIHostActivityInstanceID.Value);
                if (mainPrevousActivityInstance.ComplexType.Value == (short)ComplexTypeEnum.SignTogether)
                {
                    //如果是会签节点，则需要重新实例化会签节点上的所有办理人的任务
                    nodeMediatorBackward.CreateBackwardActivityTaskRepeatedSignTogetherMultipleInstance(
                        base.BackwardContext.ProcessInstance,
                        base.BackwardContext.BackwardToTaskActivity,
                        base.BackwardContext.BackwardFromActivityInstance,
                        BackwardTypeEnum.Sendback,
                        mainPrevousActivityInstance,
                        base.BackwardContext.BackwardToTargetTransitionGUID,
                        TransitionTypeEnum.Sendback,
                        TransitionFlyingTypeEnum.NotFlying,
                        base.ActivityResource,
                        session);

                    //更新当前办理节点的状态（从准备或运行状态更新为退回状态）
                    aim.SendBack(base.BackwardContext.BackwardFromActivityInstance.ID,
                        base.ActivityResource.AppRunner,
                        session);
                }
                else if (mainPrevousActivityInstance.ComplexType.Value == (short)ComplexTypeEnum.SignForward)
                {
                    //上一步节点是加签节点的退回处理
                    nodeMediatorBackward.CreateBackwardActivityTaskRepateSignForwardMainNodeOnly(base.BackwardContext.ProcessInstance,
                        base.BackwardContext.BackwardToTaskActivity,
                        base.BackwardContext.BackwardFromActivityInstance,
                        BackwardTypeEnum.Sendback,
                        mainPrevousActivityInstance,
                        base.BackwardContext.BackwardToTargetTransitionGUID,
                        TransitionTypeEnum.Sendback,
                        TransitionFlyingTypeEnum.NotFlying,
                        base.ActivityResource,
                        session);

                    //更新当前办理节点的状态（从准备或运行状态更新为退回状态）
                    aim.SendBack(base.BackwardContext.BackwardFromActivityInstance.ID,
                        base.ActivityResource.AppRunner,
                        session);
                }
            }
            else
            {
                //上一步节点是普通节点的退回处理
                nodeMediatorBackward.CreateBackwardActivityTaskTransitionInstance(base.BackwardContext.ProcessInstance,
                    base.BackwardContext.BackwardFromActivityInstance,
                    BackwardTypeEnum.Sendback,
                    backMostPreviouslyActivityInstanceID,
                    base.BackwardContext.BackwardToTargetTransitionGUID,
                    TransitionTypeEnum.Sendback,
                    TransitionFlyingTypeEnum.NotFlying,
                    base.ActivityResource,
                    session);

                //更新当前办理节点的状态（从准备或运行状态更新为退回状态）
                aim.SendBack(base.BackwardContext.BackwardFromActivityInstance.ID,
                    base.ActivityResource.AppRunner,
                    session);
            }

            //构造回调函数需要的数据
            WfExecutedResult result = base.WfExecutedResult;
            result.BackwardTaskReciever = base.BackwardContext.BackwardTaskReciever;
            result.Status = WfExecutedStatus.Success;
        }
    }
}
